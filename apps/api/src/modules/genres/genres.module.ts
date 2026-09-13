import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { GenresAdminController } from './genres.admin.controller';
import { GenresController } from './genres.controller';
import { GenresRepository } from './genres.repository';
import { GenresService } from './genres.service';

/**
 * Both controllers are registered here, so the public and admin surfaces of
 * one aggregate stay together while remaining separate classes.
 *
 * `CursorService` and `SlugService` are provided per module rather than
 * globally: they are stateless, and a local provider keeps the dependency
 * visible in the module that uses it.
 */
@Module({
  controllers: [GenresController, GenresAdminController],
  providers: [GenresRepository, GenresService, CursorService, SlugService],
  exports: [GenresService],
})
export class GenresModule {}
