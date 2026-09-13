import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  MediaConfirmInput,
  MediaPurposeSchema,
  MediaResourceTypeSchema,
  MediaUpdateInput,
  MediaUploadSignatureInput,
} from '@dj/contracts';

export class MediaUploadSignatureDto extends createZodDto(MediaUploadSignatureInput) {}
export class MediaConfirmDto extends createZodDto(MediaConfirmInput) {}
export class MediaUpdateDto extends createZodDto(MediaUpdateInput) {}

export const MediaAdminListQuery = z.object({
  q: z.string().max(120).optional(),
  purpose: MediaPurposeSchema.optional(),
  resourceType: MediaResourceTypeSchema.optional(),
  trashed: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class MediaAdminListQueryDto extends createZodDto(MediaAdminListQuery) {}
