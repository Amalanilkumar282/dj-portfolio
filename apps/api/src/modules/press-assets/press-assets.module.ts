import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { CloudinaryModule } from '../../infra/cloudinary/cloudinary.module';
import { MediaModule } from '../media/media.module';
import { PersonasModule } from '../personas/personas.module';
import { SettingsModule } from '../settings/settings.module';
import { StatsModule } from '../stats/stats.module';

import { PressAssetsAdminController } from './press-assets.admin.controller';
import { PressAssetsController } from './press-assets.controller';
import { PressAssetsRepository } from './press-assets.repository';
import { PressAssetsService } from './press-assets.service';
import { PressKitGeneratorService } from './press-kit-generator.service';

@Module({
  imports: [PersonasModule, StatsModule, SettingsModule, MediaModule, CloudinaryModule],
  controllers: [PressAssetsController, PressAssetsAdminController],
  providers: [PressAssetsRepository, PressAssetsService, PressKitGeneratorService, CursorService],
  exports: [PressAssetsService],
})
export class PressAssetsModule {}
