import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, FaqCreateInput, FaqQuery, FaqUpdateInput } from '@dj/contracts';

export class FaqCreateDto extends createZodDto(FaqCreateInput) {}
export class FaqUpdateDto extends createZodDto(FaqUpdateInput) {}
export class FaqQueryDto extends createZodDto(FaqQuery) {}

export const FaqAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class FaqAdminQueryDto extends createZodDto(FaqAdminQuery) {}
