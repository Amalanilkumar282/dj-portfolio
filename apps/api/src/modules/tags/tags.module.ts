import { Module } from '@nestjs/common';

import { SlugService } from '../../common/services/slug.service';

import { TagsAdminController } from './tags.admin.controller';
import { TagsController } from './tags.controller';
import { TagsRepository } from './tags.repository';
import { TagsService } from './tags.service';

@Module({
  controllers: [TagsController, TagsAdminController],
  providers: [TagsRepository, TagsService, SlugService],
  exports: [TagsService],
})
export class TagsModule {}
