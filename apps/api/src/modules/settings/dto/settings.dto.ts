import { createZodDto } from 'nestjs-zod';

import { SiteSettingsUpdateInput } from '@dj/contracts';

export class SettingsUpdateDto extends createZodDto(SiteSettingsUpdateInput) {}
