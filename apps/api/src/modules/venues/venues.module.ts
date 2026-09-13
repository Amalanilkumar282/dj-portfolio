import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { VenuesAdminController } from './venues.admin.controller';
import { VenuesController } from './venues.controller';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

/**
 * Both controllers are registered here, so the public and admin surfaces of
 * one aggregate stay together while remaining separate classes.
 *
 * `CursorService` and `SlugService` are provided per module rather than
 * globally: they are stateless, and a local provider keeps the dependency
 * visible in the module that uses it.
 */
@Module({
  controllers: [VenuesController, VenuesAdminController],
  providers: [VenuesRepository, VenuesService, CursorService, SlugService],
  exports: [VenuesService],
})
export class VenuesModule {}
