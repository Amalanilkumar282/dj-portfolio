import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AuditAction } from '@dj/db';

import { CloudinaryService } from '../../infra/cloudinary/cloudinary.service';
import { AuditService } from '../audit/audit.service';

import { MediaRepository } from './media.repository';
import { MEDIA_TRASH_RETENTION_DAYS } from './media.service';

const CLOUDINARY_RESOURCE_TYPE: Record<string, 'image' | 'video' | 'raw'> = {
  IMAGE: 'image',
  AUDIO: 'video',
  VIDEO: 'video',
  RAW: 'raw',
};

/**
 * Nightly purge of assets soft-deleted more than 30 days ago — from both the
 * database and Cloudinary.
 *
 * Runs at 03:15 IST (21:45 UTC), the low-traffic hour for a Bengaluru-based
 * audience. Guarded by `pg_try_advisory_xact_lock` in the repository, so a
 * second replica (there is only one at launch, but the guard costs nothing
 * and pays for a future scale-out) skips rather than double-purging. See
 * `MediaRepository.sweepOrphans`.
 */
@Injectable()
export class MediaOrphanSweepCron {
  private readonly logger = new Logger(MediaOrphanSweepCron.name);

  constructor(
    private readonly repository: MediaRepository,
    private readonly cloudinary: CloudinaryService,
    private readonly audit: AuditService,
  ) {}

  @Cron('45 21 * * *', { name: 'media-orphan-sweep' })
  async run(): Promise<void> {
    const cutoff = new Date(Date.now() - MEDIA_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.repository.sweepOrphans(cutoff, 200, async (asset) => {
      const resourceType = CLOUDINARY_RESOURCE_TYPE[asset.resourceType] ?? 'image';
      try {
        await this.cloudinary.destroyResource(asset.publicId, resourceType);
      } catch (error) {
        this.logger.error(
          `Cloudinary destroy failed for "${asset.publicId}"; the DB row will still be purged`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });

    if (!result.ran) {
      this.logger.debug('media_orphan_sweep skipped: lock held by another run');
      return;
    }

    if (result.processed > 0) {
      this.logger.log(`media_orphan_sweep purged ${String(result.processed)} asset(s)`);
    }

    await this.audit.record({
      action: AuditAction.MEDIA_DELETE,
      entityType: 'MediaAsset',
      metadata: { sweep: true, purged: result.processed },
    });
  }
}
