import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ContentStatusSchema,
  PressAssetCreateInput,
  PressAssetDownloadInput,
  PressAssetQuery,
  PressAssetUpdateInput,
} from '@dj/contracts';

export class PressAssetCreateDto extends createZodDto(PressAssetCreateInput) {}
export class PressAssetUpdateDto extends createZodDto(PressAssetUpdateInput) {}
export class PressAssetQueryDto extends createZodDto(PressAssetQuery) {}
export class PressAssetDownloadDto extends createZodDto(PressAssetDownloadInput) {}

export const PressAssetAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class PressAssetAdminQueryDto extends createZodDto(PressAssetAdminQuery) {}
