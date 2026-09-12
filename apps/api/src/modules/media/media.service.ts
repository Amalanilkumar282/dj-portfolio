import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  MediaAssetAdminDetail,
  MediaConfirmInput,
  MediaUpdateInput,
  MediaUploadSignatureInput,
  MediaUploadSignatureResult,
} from '@dj/contracts';
import { AuditAction, type MediaResourceType } from '@dj/db';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { RequestContextService } from '../../common/services/request-context.service';
import { CloudinaryService, NAMED_TRANSFORMS } from '../../infra/cloudinary/cloudinary.service';
import { CONTENT_CHANGED } from '../../infra/revalidation/revalidation.service';
import { AuditService } from '../audit/audit.service';

import { toMediaAdminDetail } from './media.mapper';
import { MediaRepository, type MediaUpdateData } from './media.repository';

const CLOUDINARY_RESOURCE_TYPE: Record<MediaResourceType, 'image' | 'video' | 'raw'> = {
  IMAGE: 'image',
  // Cloudinary has no distinct "audio" resource type — audio is uploaded and
  // stored as `video`. See docs/02-architecture/media-pipeline.md.
  AUDIO: 'video',
  VIDEO: 'video',
  RAW: 'raw',
};

/** Retained 30 days in the trash before the sweeper hard-deletes it. */
export const MEDIA_TRASH_RETENTION_DAYS = 30;

@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
    private readonly cloudinary: CloudinaryService,
    private readonly context: RequestContextService,
  ) {}

  /**
   * The server decides the destination. A client can influence it only
   * through `purpose`/`entityType`/`personaSlug` — it never supplies a raw
   * folder or public_id, which is what keeps a signed upload from writing
   * outside its taxonomy. See docs/02-architecture/media-pipeline.md.
   */
  createUploadSignature(input: MediaUploadSignatureInput): MediaUploadSignatureResult {
    const folder = this.folderFor(input);

    // `resource_type` is deliberately NOT included here. Cloudinary's own
    // signature verification excludes `resource_type` (along with `file`,
    // `api_key` and `cloud_name`) from the string it hashes — it is a URL
    // path segment, not a signed param. Including it here computed a
    // signature Cloudinary would never match, so every real upload failed
    // with "Invalid Signature" — caught by actually driving one through
    // the admin media library (Group E), not by the local signing test
    // that shipped with Phase 5, which only checked the signature was
    // *computed*, never that Cloudinary would accept it.
    const params: Record<string, string | number | boolean> = { folder };

    // Derivatives are generated asynchronously only for images: eagerly
    // transcoding video/audio on every upload would be slow and mostly
    // unused at this catalogue size.
    let eager: string | undefined;
    if (input.resourceType === 'IMAGE') {
      eager = `${NAMED_TRANSFORMS.card}|${NAMED_TRANSFORMS.og}`;
      params.eager = eager;
      params.eager_async = true;
    }

    const signed = this.cloudinary.signUpload(params);

    return {
      signature: signed.signature,
      timestamp: signed.timestamp,
      apiKey: signed.apiKey,
      cloudName: signed.cloudName,
      folder,
      resourceType: input.resourceType,
      eager: eager ?? null,
      eagerAsync: eager ? true : null,
    };
  }

  /**
   * Re-reads authoritative metadata from Cloudinary and writes the row.
   *
   * The client's own claims about bytes/format/dimensions are never trusted
   * — this is the whole point of the two-call flow. See ADR
   * docs/01-decisions/0008-cloudinary-signed-direct-upload.md.
   */
  async confirm(input: MediaConfirmInput): Promise<MediaAssetAdminDetail> {
    if (await this.repository.isPublicIdTaken(input.publicId)) {
      throw new ConflictException({
        message: `An asset for "${input.publicId}" has already been confirmed.`,
        code: ERROR_CODES.UNIQUE_CONSTRAINT,
      });
    }

    const cloudinaryType = CLOUDINARY_RESOURCE_TYPE[input.resourceType];
    const resource = await this.cloudinary.fetchResource(input.publicId, cloudinaryType);

    const dominantColor = resource.colors?.[0]?.[0] ?? null;
    const blurDataUrl =
      input.resourceType === 'IMAGE' ? await this.fetchBlurDataUrl(input.publicId) : null;

    const folder = input.publicId.includes('/')
      ? input.publicId.slice(0, input.publicId.lastIndexOf('/'))
      : '';

    const created = await this.repository.create({
      publicId: input.publicId,
      resourceType: input.resourceType,
      format: resource.format,
      version: resource.version ?? null,
      bytes: resource.bytes,
      width: resource.width ?? null,
      height: resource.height ?? null,
      aspectRatio: resource.width && resource.height ? resource.width / resource.height : null,
      durationSec: resource.duration ?? null,
      pages: resource.pages ?? null,
      secureUrl: resource.secure_url,
      folder,
      purpose: input.purpose,
      originalFilename: resource.original_filename ?? null,
      etag: resource.etag ?? null,
      colors: resource.colors ?? null,
      dominantColor,
      blurDataUrl,
      altText: input.altText ?? null,
      caption: input.caption ?? null,
      credit: input.credit ?? null,
      tags: input.tags ?? [],
      uploadedById: this.context.userId ?? null,
    });

    await this.audit.record({
      action: AuditAction.MEDIA_UPLOAD,
      entityType: 'MediaAsset',
      entityId: created.id,
      metadata: { publicId: created.publicId, bytes: created.bytes },
    });

    return toMediaAdminDetail(created);
  }

  async findAdminById(id: string): Promise<MediaAssetAdminDetail> {
    return toMediaAdminDetail(await this.loadForAdmin(id));
  }

  /**
   * Records a MediaAsset for a file the server generated and uploaded
   * itself — the EPK PDF — rather than one a browser uploaded through the
   * signed direct-upload flow above.
   *
   * Upserts by `publicId`: the PDF regenerator always uploads to the same
   * `public_id` with `overwrite: true`, so a re-generation updates the
   * existing row in place instead of accumulating one row per regeneration
   * that the orphan sweeper would otherwise have to catch up on.
   */
  async recordServerUpload(data: {
    publicId: string;
    resourceType: 'RAW';
    format: string;
    bytes: number;
    secureUrl: string;
    folder: string;
    purpose: 'DOCUMENT';
    originalFilename?: string | null;
  }): Promise<{ id: string }> {
    const existing = await this.repository.findByPublicId(data.publicId);

    if (existing) {
      const updated = await this.repository.updateServerUploadStats(existing.id, {
        bytes: data.bytes,
        secureUrl: data.secureUrl,
      });
      return { id: updated.id };
    }

    const created = await this.repository.create({
      publicId: data.publicId,
      resourceType: data.resourceType,
      format: data.format,
      version: null,
      bytes: data.bytes,
      width: null,
      height: null,
      aspectRatio: null,
      durationSec: null,
      pages: null,
      secureUrl: data.secureUrl,
      folder: data.folder,
      purpose: data.purpose,
      originalFilename: data.originalFilename ?? null,
      etag: null,
      colors: null,
      dominantColor: null,
      blurDataUrl: null,
      altText: null,
      caption: null,
      credit: null,
      tags: [],
      uploadedById: null,
    });

    return { id: created.id };
  }

  async listAdmin(query: {
    q?: string | undefined;
    purpose?: string | undefined;
    resourceType?: string | undefined;
    trashed?: boolean | undefined;
    sort: { field: string; direction: 'asc' | 'desc' }[];
    perPage: number;
    page: number;
  }): Promise<{ data: MediaAssetAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      purpose: query.purpose,
      resourceType: query.resourceType,
      trashed: query.trashed,
      orderBy: query.sort.map((s) => ({ [s.field]: s.direction })),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toMediaAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async update(id: string, input: MediaUpdateInput): Promise<MediaAssetAdminDetail> {
    await this.loadForAdmin(id);

    const data: MediaUpdateData = {};
    if (input.altText !== undefined) data.altText = input.altText;
    if (input.caption !== undefined) data.caption = input.caption;
    if (input.credit !== undefined) data.credit = input.credit;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.focalX !== undefined) data.focalX = input.focalX;
    if (input.focalY !== undefined) data.focalY = input.focalY;
    if (input.isSensitive !== undefined) data.isSensitive = input.isSensitive;

    const updated = await this.repository.update(id, data);

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: 'MediaAsset',
      entityId: id,
      metadata: { changed: Object.keys(input) },
    });

    // Any entity embedding this image (MediaImageSchema) is now stale.
    this.events.emit(CONTENT_CHANGED, { entity: 'persona', id: 'media-update', action: 'update' });

    return toMediaAdminDetail(updated);
  }

  /**
   * Two-phase delete. Without `force`, refuses (409) if anything still
   * references the asset, listing what. With `force` (and `media:delete`,
   * checked by the guard), nullable references are cleared first — but a
   * `GalleryItem` reference is never force-cleared: its `mediaId` is
   * required, so removing it would mean deleting the gallery item itself,
   * which this endpoint does not do.
   *
   * Either way this is a **soft** delete: the row and the Cloudinary asset
   * both survive, recoverable for `MEDIA_TRASH_RETENTION_DAYS`. Only the
   * nightly sweeper hard-deletes.
   */
  async remove(id: string, force: boolean): Promise<void> {
    await this.loadForAdmin(id);

    const counts = await this.repository.countReferences(id);
    const total = counts.nullable + counts.galleryItems;

    if (total > 0) {
      if (!force) {
        throw new ConflictException({
          message: `This asset is still used by ${String(total)} item(s). Pass force=true to detach it from all of them, or re-point them first.`,
          code: ERROR_CODES.MEDIA_IN_USE,
          errors: (await this.repository.listReferences(id)).map((reference) => ({
            pointer: '/id',
            code: 'in_use',
            message: `${reference.entity}: ${reference.title}`,
          })),
        });
      }

      if (counts.galleryItems > 0) {
        throw new ConflictException({
          message: `This asset is used by ${String(counts.galleryItems)} gallery item(s), which cannot be force-detached — remove it from the gallery first.`,
          code: ERROR_CODES.MEDIA_IN_USE,
        });
      }

      await this.repository.clearNullableReferences(id);
    }

    await this.repository.softDelete(id);

    await this.audit.record({
      action: AuditAction.MEDIA_DELETE,
      entityType: 'MediaAsset',
      entityId: id,
      metadata: { force, referencesCleared: total },
    });
  }

  async restore(id: string): Promise<MediaAssetAdminDetail> {
    const restored = await this.repository.restore(id);

    await this.audit.record({
      action: AuditAction.RESTORE,
      entityType: 'MediaAsset',
      entityId: id,
    });

    return toMediaAdminDetail(restored);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private folderFor(input: MediaUploadSignatureInput): string {
    const root = this.cloudinary.rootFolder();
    const segments = [root, input.entityType];

    if (input.personaSlug) segments.push(input.personaSlug);
    segments.push(input.purpose.toLowerCase());

    return segments.join('/');
  }

  /**
   * Downloads the tiny `t_djf_blur` derivative and inlines it as a data URI,
   * so `placeholder="blur"` costs nothing at render time. A random
   * `?v=` component is not needed here — Cloudinary derivatives are
   * generated on first request, and this is that first request.
   */
  private async fetchBlurDataUrl(publicId: string): Promise<string | null> {
    try {
      const url = this.cloudinary.blurUrl(publicId);
      const response = await fetch(url);
      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') ?? 'image/webp';
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch {
      // A missing placeholder degrades to no blur, not a failed upload —
      // the asset itself is already safely stored by this point.
      return null;
    }
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);

    if (!row) {
      throw new NotFoundException({
        message: `No media asset exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
