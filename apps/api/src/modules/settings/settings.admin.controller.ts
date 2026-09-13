import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SiteSettingsAdminDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, RequirePermissions } from '../../common/decorators';

import { SettingsUpdateDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

/** No create, no delete, no list: there is exactly one row, ever. */
@ApiTags('admin: settings')
@ApiBearerAuth()
@Controller('admin/settings')
@CacheControl(CACHE_POLICIES.noStore)
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Site settings, including fields the public response omits' })
  async get(): Promise<SiteSettingsAdminDetail> {
    return this.settings.getAdmin();
  }

  @Patch()
  @RequirePermissions('settings:write')
  @ApiOperation({ summary: 'Update settings. Unmentioned fields are untouched.' })
  async update(@Body() dto: SettingsUpdateDto): Promise<SiteSettingsAdminDetail> {
    return this.settings.update(dto);
  }
}
