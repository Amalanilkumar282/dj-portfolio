import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  ProgramCreateInput,
  ProgramQuery,
  ProgramUpdateInput,
} from '@dj/contracts';

export class ProgramCreateDto extends createZodDto(ProgramCreateInput) {}
export class ProgramUpdateDto extends createZodDto(ProgramUpdateInput) {}
export class ProgramQueryDto extends createZodDto(ProgramQuery) {}

export const ProgramAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  personaSlug: z.string().optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class ProgramAdminQueryDto extends createZodDto(ProgramAdminQuery) {}
