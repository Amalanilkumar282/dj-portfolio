import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, StaticPageCreateInput, StaticPageUpdateInput } from '@dj/contracts';

export class StaticPageCreateDto extends createZodDto(StaticPageCreateInput) {}
export class StaticPageUpdateDto extends createZodDto(StaticPageUpdateInput) {}

export const StaticPageAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class StaticPageAdminQueryDto extends createZodDto(StaticPageAdminQuery) {}
