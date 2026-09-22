import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, VideoCreateInput, VideoQuery, VideoUpdateInput } from '@dj/contracts';

export class VideoCreateDto extends createZodDto(VideoCreateInput) {}
export class VideoUpdateDto extends createZodDto(VideoUpdateInput) {}
export class VideoQueryDto extends createZodDto(VideoQuery) {}

export const VideoAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class VideoAdminQueryDto extends createZodDto(VideoAdminQuery) {}
