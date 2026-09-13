import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, PostCreateInput, PostQuery, PostUpdateInput } from '@dj/contracts';

export class PostCreateDto extends createZodDto(PostCreateInput) {}
export class PostUpdateDto extends createZodDto(PostUpdateInput) {}
export class PostQueryDto extends createZodDto(PostQuery) {}

export const PostAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class PostAdminQueryDto extends createZodDto(PostAdminQuery) {}
