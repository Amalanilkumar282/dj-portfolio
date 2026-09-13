import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global, so repositories can inject PrismaService without every feature
 * module re-importing it.
 *
 * The access restriction is enforced by lint rather than by module wiring:
 * restricting it at the module level would mean 20 modules each importing
 * PrismaModule, which is noise that hides nothing.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
