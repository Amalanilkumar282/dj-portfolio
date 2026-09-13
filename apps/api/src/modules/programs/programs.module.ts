import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { ProgramsAdminController } from './programs.admin.controller';
import { ProgramsController } from './programs.controller';
import { ProgramsRepository } from './programs.repository';
import { ProgramsService } from './programs.service';

@Module({
  imports: [PersonasModule],
  controllers: [ProgramsController, ProgramsAdminController],
  providers: [ProgramsRepository, ProgramsService, CursorService, SlugService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
