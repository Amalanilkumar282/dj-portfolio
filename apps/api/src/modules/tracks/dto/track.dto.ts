import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, TrackCreateInput, TrackQuery, TrackUpdateInput } from '@dj/contracts';

export class TrackCreateDto extends createZodDto(TrackCreateInput) {}
export class TrackUpdateDto extends createZodDto(TrackUpdateInput) {}
export class TrackQueryDto extends createZodDto(TrackQuery) {}

/** Admin list query. Offset-paginated, every status. */
export const TrackAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  personaSlug: z.string().optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class TrackAdminQueryDto extends createZodDto(TrackAdminQuery) {}
