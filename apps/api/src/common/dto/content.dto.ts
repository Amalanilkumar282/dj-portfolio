import { createZodDto } from 'nestjs-zod';

import { ReorderInput, ScheduleInput } from '@dj/contracts';

/** Shared admin DTOs, used by every content module. */
export class ReorderDto extends createZodDto(ReorderInput) {}
export class ScheduleDto extends createZodDto(ScheduleInput) {}
