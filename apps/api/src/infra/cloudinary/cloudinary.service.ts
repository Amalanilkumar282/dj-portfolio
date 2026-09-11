import { Injectable, Logger, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { ERROR_CODES } from '../../common/problems';
import type { Env } from '../../config/env.schema';

/**
 * The subset of Cloudinary's Admin API `resource()` response `MediaService`
 * needs, typed by what is actually optional at runtime rather than by the
 * SDK's `UploadApiResponse` — which declares fields like `pages` and
 * `colors` as always-present even though Cloudinary only returns them for
 * the resource types they apply to.
 */
export interface CloudinaryResourceMetadata {
  format: string;
  version?: number;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  secure_url: string;
  original_filename?: string;
  etag?: string;
  colors?: [string, number][];
}

/** Named transformations, bootstrapped once and referenced by name so the
 *  transform strings never scatter into application code. See
 *  docs/02-architecture/media-pipeline.md. */
export const NAMED_TRANSFORMS = {
  card: 'c_fill,g_auto:faces,w_800,h_1000,q_auto,f_auto',
  og: 'c_fill,w_1200,h_630,q_auto,f_jpg',
  blur: 'c_fill,w_16,h_16,e_blur:400,q_30,f_webp',
} as const;

/**
 * Cloudinary SDK wrapper.
 *
 * Phase 2 configured the SDK and exposed a readiness signal. Phase 5 adds the
 * signed-upload flow, the metadata re-read used by `MediaService.confirm()`,
 * and the destroy call the orphan sweeper uses. See
 * docs/02-architecture/media-pipeline.md.
 *
 * CLOUDINARY_API_SECRET is server-only and must never reach a frontend.
 */
@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;
  private apiKey = '';
  private cloudName = '';

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
    const apiKey = this.config.get('CLOUDINARY_API_KEY', { infer: true });
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    this.apiKey = apiKey;
    this.cloudName = cloudName;

    // Placeholder values are the normal state until real credentials exist,
    // so this reports rather than throws at boot. A live upload/confirm call
    // made against placeholder credentials fails at the Cloudinary API call
    // itself — see `isConfigured()`'s callers below.
    this.configured = !/replace-me|^test$/.test(apiSecret);

    if (this.configured) {
      this.logger.log(`Cloudinary configured for cloud "${cloudName}"`);
    } else {
      this.logger.warn('Cloudinary credentials are placeholders; uploads will fail');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** The root folder for this environment, e.g. `djf-prod`. */
  rootFolder(): string {
    return this.config.get('CLOUDINARY_ROOT_FOLDER', { infer: true });
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException({
        message:
          'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET to real values.',
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
      });
    }
  }

  /**
   * Signs a set of upload params for direct browser -> Cloudinary upload.
   *
   * The server decides `folder`, `public_id` prefix and `eager` — the caller
   * never gets to name the destination, which is what keeps a signed upload
   * from writing outside its taxonomy. See `MediaService.createUploadSignature`.
   */
  signUpload(params: Record<string, string | number | boolean>): {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
  } {
    this.assertConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = { ...params, timestamp };
    const secret = this.config.get('CLOUDINARY_API_SECRET', { infer: true });

    const signature = cloudinary.utils.api_sign_request(toSign, secret);

    return { signature, timestamp, apiKey: this.apiKey, cloudName: this.cloudName };
  }

  /**
   * Re-reads authoritative metadata for a just-uploaded asset.
   *
   * `MediaService.confirm()` calls this instead of trusting whatever the
   * client claims about bytes/format/dimensions — see ADR
   * docs/01-decisions/0008-cloudinary-signed-direct-upload.md.
   */
  async fetchResource(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw',
  ): Promise<CloudinaryResourceMetadata> {
    this.assertConfigured();

    return cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      colors: true,
      image_metadata: false,
    }) as Promise<CloudinaryResourceMetadata>;
  }

  /** Fetches the small blur derivative as base64, for `blurDataUrl`. */
  blurUrl(publicId: string): string {
    return cloudinary.url(publicId, { transformation: NAMED_TRANSFORMS.blur, secure: true });
  }

  /**
   * A signed, expiring attachment URL for a gated press-kit download. See
   * the caveat on `PressAssetsService.requestDownload()` about what this
   * does and does not restrict for `type: upload` resources.
   */
  privateDownloadUrl(
    publicId: string,
    format: string,
    options: { resourceType: 'image' | 'video' | 'raw'; expiresAt: number },
  ): string {
    this.assertConfigured();

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: options.resourceType,
      expires_at: options.expiresAt,
      attachment: true,
    });
  }

  /** Hard-deletes the asset from Cloudinary. Used only by the orphan sweeper. */
  async destroyResource(publicId: string, resourceType: 'image' | 'video' | 'raw'): Promise<void> {
    if (!this.configured) {
      this.logger.warn(`Skipping Cloudinary destroy for "${publicId}": not configured`);
      return;
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  }

  /**
   * Server-generated uploads (the EPK PDF), as opposed to the signed
   * browser-direct flow above. `overwrite: true` with a fixed `publicId` is
   * deliberate: regenerating the EPK on a bio/stats change should replace
   * the existing asset in place rather than accumulate versions the sweeper
   * would otherwise have to prune.
   */
  async uploadBuffer(
    buffer: Buffer,
    options: { publicId: string; folder: string },
  ): Promise<CloudinaryResourceMetadata & { public_id: string }> {
    this.assertConfigured();

    const dataUri = `data:application/pdf;base64,${buffer.toString('base64')}`;

    return cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw',
      folder: options.folder,
      public_id: options.publicId,
      overwrite: true,
    });
  }
}
