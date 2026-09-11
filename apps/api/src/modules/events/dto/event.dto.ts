import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, EventCreateInput, EventQuery, EventUpdateInput } from '@dj/contracts';

export class EventCreateDto extends createZodDto(EventCreateInput) {}
export class EventUpdateDto extends createZodDto(EventUpdateInput) {}
export class EventQueryDto extends createZodDto(EventQuery) {}

export const EventAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  personaSlug: z.string().optional(),
  when: z.enum(['upcoming', 'past', 'all']).default('all'),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class EventAdminQueryDto extends createZodDto(EventAdminQuery) {}
