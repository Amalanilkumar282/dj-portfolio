import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { BrandCreateInput, BrandQuery, BrandUpdateInput, ContentStatusSchema } from '@dj/contracts';

export class BrandCreateDto extends createZodDto(BrandCreateInput) {}
export class BrandUpdateDto extends createZodDto(BrandUpdateInput) {}
export class BrandQueryDto extends createZodDto(BrandQuery) {}

export const BrandAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class BrandAdminQueryDto extends createZodDto(BrandAdminQuery) {}
