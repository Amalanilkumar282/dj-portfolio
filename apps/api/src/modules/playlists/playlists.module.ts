import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { PlaylistsAdminController } from './playlists.admin.controller';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsRepository } from './playlists.repository';
import { PlaylistsService } from './playlists.service';

@Module({
  imports: [PersonasModule],
  controllers: [PlaylistsController, PlaylistsAdminController],
  providers: [PlaylistsRepository, PlaylistsService, CursorService, SlugService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
