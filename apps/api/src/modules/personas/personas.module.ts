import { Module } from '@nestjs/common';

import { CursorService } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';

import { PersonasAdminController } from './personas.admin.controller';
import { PersonasController } from './personas.controller';
import { PersonasRepository } from './personas.repository';
import { PersonasService } from './personas.service';

/**
 * Both controllers are registered here, so the public and admin surfaces of
 * one aggregate stay together while remaining separate classes.
 *
 * CursorService and SlugService are provided per module rather than globally:
 * they are stateless, and a local provider keeps the dependency visible in
 * the module that uses it.
 */
@Module({
  controllers: [PersonasController, PersonasAdminController],
  providers: [PersonasRepository, PersonasService, CursorService, SlugService],
  exports: [PersonasService],
})
export class PersonasModule {}
