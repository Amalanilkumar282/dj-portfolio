import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  ReleaseCreateInput,
  ReleaseQuery,
  ReleaseUpdateInput,
} from '@dj/contracts';

export class ReleaseCreateDto extends createZodDto(ReleaseCreateInput) {}
export class ReleaseUpdateDto extends createZodDto(ReleaseUpdateInput) {}
export class ReleaseQueryDto extends createZodDto(ReleaseQuery) {}

export const ReleaseAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  personaSlug: z.string().optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class ReleaseAdminQueryDto extends createZodDto(ReleaseAdminQuery) {}
