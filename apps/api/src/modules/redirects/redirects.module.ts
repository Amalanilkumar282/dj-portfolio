import { Module } from '@nestjs/common';

import { RedirectsAdminController } from './redirects.admin.controller';
import { RedirectsController } from './redirects.controller';
import { RedirectsRepository } from './redirects.repository';
import { RedirectsService } from './redirects.service';

@Module({
  controllers: [RedirectsController, RedirectsAdminController],
  providers: [RedirectsRepository, RedirectsService],
  exports: [RedirectsService],
})
export class RedirectsModule {}
