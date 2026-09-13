import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { TracksAdminController } from './tracks.admin.controller';
import { TracksController } from './tracks.controller';
import { TracksRepository } from './tracks.repository';
import { TracksService } from './tracks.service';

/** Imports `PersonasModule` to resolve `personaKey` -> persona id on write. */
@Module({
  imports: [PersonasModule],
  controllers: [TracksController, TracksAdminController],
  providers: [TracksRepository, TracksService, CursorService, SlugService],
  exports: [TracksService],
})
export class TracksModule {}
