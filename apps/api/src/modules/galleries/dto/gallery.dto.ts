import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, GalleryCreateInput, GalleryQuery, GalleryUpdateInput } from '@dj/contracts';

export class GalleryCreateDto extends createZodDto(GalleryCreateInput) {}
export class GalleryUpdateDto extends createZodDto(GalleryUpdateInput) {}
export class GalleryQueryDto extends createZodDto(GalleryQuery) {}

export const GalleryAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class GalleryAdminQueryDto extends createZodDto(GalleryAdminQuery) {}
