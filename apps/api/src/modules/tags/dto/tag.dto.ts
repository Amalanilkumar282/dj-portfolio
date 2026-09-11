import { createZodDto } from 'nestjs-zod';

import { TagCreateInput, TagQuery, TagUpdateInput } from '@dj/contracts';

export class TagCreateDto extends createZodDto(TagCreateInput) {}
export class TagUpdateDto extends createZodDto(TagUpdateInput) {}
export class TagQueryDto extends createZodDto(TagQuery) {}
