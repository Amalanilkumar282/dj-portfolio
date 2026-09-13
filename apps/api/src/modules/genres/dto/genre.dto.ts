import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { GenreCreateInput, GenreQuery, GenreUpdateInput } from '@dj/contracts';

export class GenreCreateDto extends createZodDto(GenreCreateInput) {}
export class GenreUpdateDto extends createZodDto(GenreUpdateInput) {}
export class GenreQueryDto extends createZodDto(GenreQuery) {}

/**
 * Admin list query.
 *
 * Offset-paginated rather than cursor-paginated, because an admin table needs
 * "page 7 of 23" and a jump-to-page control. Public lists use cursors, which
 * stay stable while content changes mid-scroll.
 *
 * No `status` filter, unlike the publishable resources: a genre has no
 * publish state.
 */
export const GenreAdminQuery = z.object({
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class GenreAdminQueryDto extends createZodDto(GenreAdminQuery) {}
