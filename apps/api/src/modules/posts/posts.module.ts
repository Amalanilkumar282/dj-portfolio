import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { PostsAdminController } from './posts.admin.controller';
import { PostsController } from './posts.controller';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

@Module({
  imports: [PersonasModule],
  controllers: [PostsController, PostsAdminController],
  providers: [PostsRepository, PostsService, CursorService, SlugService],
  exports: [PostsService],
})
export class PostsModule {}
