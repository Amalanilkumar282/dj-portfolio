import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  TestimonialCreateInput,
  TestimonialQuery,
  TestimonialUpdateInput,
} from '@dj/contracts';

export class TestimonialCreateDto extends createZodDto(TestimonialCreateInput) {}
export class TestimonialUpdateDto extends createZodDto(TestimonialUpdateInput) {}
export class TestimonialQueryDto extends createZodDto(TestimonialQuery) {}

export const TestimonialAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class TestimonialAdminQueryDto extends createZodDto(TestimonialAdminQuery) {}
