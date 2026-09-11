import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  PersonaCreateInput,
  PersonaQuery,
  PersonaUpdateInput,
} from '@dj/contracts';

export class PersonaCreateDto extends createZodDto(PersonaCreateInput) {}
export class PersonaUpdateDto extends createZodDto(PersonaUpdateInput) {}
export class PersonaQueryDto extends createZodDto(PersonaQuery) {}

/**
 * Admin list query.
 *
 * Offset-paginated rather than cursor-paginated, because an admin table needs
 * "page 7 of 23" and a jump-to-page control. Public lists use cursors, which
 * stay stable while new content is published mid-scroll.
 */
export const PersonaAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class PersonaAdminQueryDto extends createZodDto(PersonaAdminQuery) {}
