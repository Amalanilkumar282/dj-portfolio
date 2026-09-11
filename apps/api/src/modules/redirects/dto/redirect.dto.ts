import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { RedirectCreateInput, RedirectUpdateInput } from '@dj/contracts';

export class RedirectCreateDto extends createZodDto(RedirectCreateInput) {}
export class RedirectUpdateDto extends createZodDto(RedirectUpdateInput) {}

export const RedirectAdminQuery = z.object({
  q: z.string().max(200).optional(),
  activeOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class RedirectAdminQueryDto extends createZodDto(RedirectAdminQuery) {}
