import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { StatCreateInput, StatQuery, StatUpdateInput } from '@dj/contracts';

export class StatCreateDto extends createZodDto(StatCreateInput) {}
export class StatUpdateDto extends createZodDto(StatUpdateInput) {}
export class StatQueryDto extends createZodDto(StatQuery) {}

export const StatAdminQuery = z.object({
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class StatAdminQueryDto extends createZodDto(StatAdminQuery) {}
