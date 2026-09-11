import { Module } from '@nestjs/common';

import { CloudinaryModule } from '../../infra/cloudinary/cloudinary.module';

import { MediaOrphanSweepCron } from './media-orphan-sweep.cron';
import { MediaAdminController } from './media.admin.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';

/**
 * No public controller: a `MediaAsset` is never listed or read directly by
 * the public site — it always arrives embedded as `MediaImageSchema` inside
 * the entity that references it (a persona's `heroImage`, a track's
 * `artwork`, ...). Only the admin surface needs first-class media endpoints.
 */
@Module({
  imports: [CloudinaryModule],
  controllers: [MediaAdminController],
  providers: [MediaRepository, MediaService, MediaOrphanSweepCron],
  exports: [MediaService],
})
export class MediaModule {}
