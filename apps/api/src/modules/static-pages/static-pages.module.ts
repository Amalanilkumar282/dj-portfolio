import { Module } from '@nestjs/common';

import { SlugService } from '../../common/services/slug.service';

import { StaticPagesAdminController } from './static-pages.admin.controller';
import { StaticPagesController } from './static-pages.controller';
import { StaticPagesRepository } from './static-pages.repository';
import { StaticPagesService } from './static-pages.service';

@Module({
  controllers: [StaticPagesController, StaticPagesAdminController],
  providers: [StaticPagesRepository, StaticPagesService, SlugService],
  exports: [StaticPagesService],
})
export class StaticPagesModule {}
