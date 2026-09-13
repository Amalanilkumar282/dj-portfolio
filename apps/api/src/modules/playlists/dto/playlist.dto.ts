import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  PlaylistCreateInput,
  PlaylistQuery,
  PlaylistUpdateInput,
} from '@dj/contracts';

export class PlaylistCreateDto extends createZodDto(PlaylistCreateInput) {}
export class PlaylistUpdateDto extends createZodDto(PlaylistUpdateInput) {}
export class PlaylistQueryDto extends createZodDto(PlaylistQuery) {}

export const PlaylistAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  personaSlug: z.string().optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export class PlaylistAdminQueryDto extends createZodDto(PlaylistAdminQuery) {}
