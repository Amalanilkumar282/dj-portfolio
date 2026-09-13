import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { GearAdminController } from './gear.admin.controller';
import { GearController } from './gear.controller';
import { GearRepository } from './gear.repository';
import { GearService } from './gear.service';

@Module({
  controllers: [GearController, GearAdminController],
  providers: [GearRepository, GearService, CursorService, SlugService],
  exports: [GearService],
})
export class GearModule {}
