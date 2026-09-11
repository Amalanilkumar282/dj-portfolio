import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import type { Env } from '../../config/env.schema';

/**
 * Cloudinary SDK wrapper.
 *
 * Phase 2 needs only configuration and a readiness signal. The signed-upload
 * flow, metadata re-read, transformation bootstrap and orphan sweeper all
 * arrive in Phase 5 — see docs/02-architecture/media-pipeline.md, and do not
 * add upload logic here before reading it.
 *
 * CLOUDINARY_API_SECRET is server-only and must never reach a frontend.
 */
@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

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

    // Placeholder values are the normal state until real credentials exist,
    // so this reports rather than throws. Phase 5 is where it becomes fatal.
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
}
