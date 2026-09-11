import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';

import { ExperienceAdminController } from './experience.admin.controller';
import { ExperienceController } from './experience.controller';
import { ExperienceRepository } from './experience.repository';
import { ExperienceService } from './experience.service';

@Module({
  controllers: [ExperienceController, ExperienceAdminController],
  providers: [ExperienceRepository, ExperienceService, CursorService],
  exports: [ExperienceService],
})
export class ExperienceModule {}
