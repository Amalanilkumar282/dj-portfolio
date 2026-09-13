import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { GalleriesAdminController } from './galleries.admin.controller';
import { GalleriesController } from './galleries.controller';
import { GalleriesRepository } from './galleries.repository';
import { GalleriesService } from './galleries.service';

@Module({
  controllers: [GalleriesController, GalleriesAdminController],
  providers: [GalleriesRepository, GalleriesService, CursorService, SlugService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
