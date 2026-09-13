import { Global, Module } from '@nestjs/common';

import { RevalidationService } from './revalidation.service';

/**
 * Global, because every content module emits `content.changed` and none of
 * them should have to import a caching concern to do so.
 */
@Global()
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
