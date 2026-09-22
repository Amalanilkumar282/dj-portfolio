import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { VideosAdminController } from './videos.admin.controller';
import { VideosController } from './videos.controller';
import { VideosRepository } from './videos.repository';
import { VideosService } from './videos.service';

@Module({
  controllers: [VideosController, VideosAdminController],
  providers: [VideosRepository, VideosService, CursorService, SlugService],
  exports: [VideosService],
})
export class VideosModule {}
