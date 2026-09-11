import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  ExperienceEntryCreateInput,
  ExperienceEntryQuery,
  ExperienceEntryUpdateInput,
} from '@dj/contracts';

export class ExperienceCreateDto extends createZodDto(ExperienceEntryCreateInput) {}
export class ExperienceUpdateDto extends createZodDto(ExperienceEntryUpdateInput) {}
export class ExperienceQueryDto extends createZodDto(ExperienceEntryQuery) {}

export const ExperienceAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class ExperienceAdminQueryDto extends createZodDto(ExperienceAdminQuery) {}
