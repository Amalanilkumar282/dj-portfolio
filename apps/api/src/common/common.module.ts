import { Global, Module } from '@nestjs/common';

import { DOMAIN_EVENT_BUS, domainEventBusProvider } from './events';
import { IdempotencyRepository } from './services/idempotency.repository';
import { RequestContextService } from './services/request-context.service';

/**
 * Cross-cutting providers.
 *
 * Global because these are consumed by global middleware, global interceptors
 * and by feature modules that have no business importing a "common" module
 * explicitly — AuditService needs the request context, and every module needs
 * AuditService.
 *
 * `RequestContextService` in particular MUST be a singleton: it owns the
 * AsyncLocalStorage instance, and a second instance would mean the middleware
 * writes to one store while readers look in another. Nest guarantees one
 * instance per provider token, which is exactly why it belongs here rather
 * than being newed up anywhere.
 *
 * `DOMAIN_EVENT_BUS` is aliased here so every content service can inject a
 * properly-typed event bus without referencing `EventEmitter2`, whose type
 * declaration is broken upstream. See events.ts.
 */
@Global()
@Module({
  providers: [RequestContextService, IdempotencyRepository, domainEventBusProvider],
  exports: [RequestContextService, IdempotencyRepository, DOMAIN_EVENT_BUS],
})
export class CommonModule {}
