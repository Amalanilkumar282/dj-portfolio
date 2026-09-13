import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { ServicesAdminController } from './services.admin.controller';
import { ServicesController } from './services.controller';
import { ServicesRepository } from './services.repository';
import { ServicesService } from './services.service';

@Module({
  imports: [PersonasModule],
  controllers: [ServicesController, ServicesAdminController],
  providers: [ServicesRepository, ServicesService, CursorService, SlugService],
  exports: [ServicesService],
})
export class ServicesModule {}
