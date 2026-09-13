import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, GearItemCreateInput, GearItemQuery, GearItemUpdateInput } from '@dj/contracts';

export class GearCreateDto extends createZodDto(GearItemCreateInput) {}
export class GearUpdateDto extends createZodDto(GearItemUpdateInput) {}
export class GearQueryDto extends createZodDto(GearItemQuery) {}

export const GearAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class GearAdminQueryDto extends createZodDto(GearAdminQuery) {}
