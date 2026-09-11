import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, VenueCreateInput, VenueQuery, VenueUpdateInput } from '@dj/contracts';

export class VenueCreateDto extends createZodDto(VenueCreateInput) {}
export class VenueUpdateDto extends createZodDto(VenueUpdateInput) {}
export class VenueQueryDto extends createZodDto(VenueQuery) {}

/**
 * Admin list query.
 *
 * Offset-paginated rather than cursor-paginated, because an admin table needs
 * "page 7 of 23" and a jump-to-page control. Public lists use cursors, which
 * stay stable while new content is published mid-scroll.
 */
export const VenueAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class VenueAdminQueryDto extends createZodDto(VenueAdminQuery) {}
