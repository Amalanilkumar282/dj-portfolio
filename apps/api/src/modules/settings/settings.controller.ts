import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SiteSettingsDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
@Public()
@CacheControl(CACHE_POLICIES.publicSlow)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Site-wide settings: brand, contact, NAP, default SEO, feature flags' })
  async get(): Promise<SiteSettingsDetail> {
    return this.settings.getPublic();
  }
}
