import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { ReleasesAdminController } from './releases.admin.controller';
import { ReleasesController } from './releases.controller';
import { ReleasesRepository } from './releases.repository';
import { ReleasesService } from './releases.service';

@Module({
  imports: [PersonasModule],
  controllers: [ReleasesController, ReleasesAdminController],
  providers: [ReleasesRepository, ReleasesService, CursorService, SlugService],
  exports: [ReleasesService],
})
export class ReleasesModule {}
