import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { PersonasModule } from '../personas/personas.module';

import { FaqsAdminController } from './faqs.admin.controller';
import { FaqsController } from './faqs.controller';
import { FaqsRepository } from './faqs.repository';
import { FaqsService } from './faqs.service';

@Module({
  imports: [PersonasModule],
  controllers: [FaqsController, FaqsAdminController],
  providers: [FaqsRepository, FaqsService, CursorService, SlugService],
  exports: [FaqsService],
})
export class FaqsModule {}
