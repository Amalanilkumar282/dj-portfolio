import { Module } from '@nestjs/common';

import { SettingsAdminController } from './settings.admin.controller';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController, SettingsAdminController],
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
