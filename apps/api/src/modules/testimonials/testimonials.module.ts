import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { PersonasModule } from '../personas/personas.module';

import { TestimonialsAdminController } from './testimonials.admin.controller';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsRepository } from './testimonials.repository';
import { TestimonialsService } from './testimonials.service';

@Module({
  imports: [PersonasModule],
  controllers: [TestimonialsController, TestimonialsAdminController],
  providers: [TestimonialsRepository, TestimonialsService, CursorService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
