import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { BrandsAdminController } from './brands.admin.controller';
import { BrandsController } from './brands.controller';
import { BrandsRepository } from './brands.repository';
import { BrandsService } from './brands.service';

@Module({
  controllers: [BrandsController, BrandsAdminController],
  providers: [BrandsRepository, BrandsService, CursorService, SlugService],
  exports: [BrandsService],
})
export class BrandsModule {}
