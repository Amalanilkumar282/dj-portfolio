import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { EventsPastFlagCron } from './events-past-flag.cron';
import { EventsAdminController } from './events.admin.controller';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

@Module({
  imports: [PersonasModule],
  controllers: [EventsController, EventsAdminController],
  providers: [EventsRepository, EventsService, CursorService, SlugService, EventsPastFlagCron],
  exports: [EventsService],
})
export class EventsModule {}
