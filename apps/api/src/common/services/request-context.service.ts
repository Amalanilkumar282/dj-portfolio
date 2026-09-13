import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

/** What travels with a request, available anywhere without parameter threading. */
export interface RequestContext {
  requestId: string;
  userId?: string | undefined;
  userEmail?: string | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
  /** True for cron jobs and seeds, so audit rows are attributed to "system". */
  system?: boolean | undefined;
}

/**
 * Ambient request context.
 *
 * This is what lets `@dj/db` stamp `createdBy`/`updatedBy` without every
 * service method taking an actor parameter, and what lets the audit
 * interceptor correlate a row to a log line.
 *
 * The store is opened by RequestContextInterceptor, which is registered FIRST
 * among the interceptors precisely so everything downstream can read it.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Runs `fn` with `context` visible.
   *
   * The lazy-promise trap documented in `packages/db/src/context.ts` does not
   * apply here: the caller is an interceptor that subscribes to the returned
   * Observable inside this scope, so no unstarted promise escapes it.
   */
  run<T>(context: RequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  get requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }

  get userId(): string | undefined {
    return this.storage.getStore()?.userId;
  }
}
