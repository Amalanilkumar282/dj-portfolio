import { Global, Module } from '@nestjs/common';

import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

/**
 * Global, because the AuditInterceptor is global and every feature module
 * writes to the trail. Exporting it from one place beats 20 modules each
 * importing it.
 */
@Global()
@Module({
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
