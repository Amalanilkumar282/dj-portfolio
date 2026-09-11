import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ContentStatusSchema, ServiceCreateInput, ServiceQuery, ServiceUpdateInput } from '@dj/contracts';

export class ServiceCreateDto extends createZodDto(ServiceCreateInput) {}
export class ServiceUpdateDto extends createZodDto(ServiceUpdateInput) {}
export class ServiceQueryDto extends createZodDto(ServiceQuery) {}

export const ServiceAdminQuery = z.object({
  status: ContentStatusSchema.optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export class ServiceAdminQueryDto extends createZodDto(ServiceAdminQuery) {}
