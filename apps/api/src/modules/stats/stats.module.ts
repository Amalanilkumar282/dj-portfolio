import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { PersonasModule } from '../personas/personas.module';

import { StatsAdminController } from './stats.admin.controller';
import { StatsController } from './stats.controller';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  imports: [PersonasModule],
  controllers: [StatsController, StatsAdminController],
  providers: [StatsRepository, StatsService, CursorService],
  exports: [StatsService],
})
export class StatsModule {}
