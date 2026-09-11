import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { getDbContext } from '@dj/db';

import type { Env } from '../../config/env.schema';
import { QUERY_WARN_THRESHOLD } from '../constants';
import { formatRequestId } from '../request-id';
import type { AppRequest } from '../types';

/**
 * The N+1 canary.
 *
 * Reads the per-request Prisma operation count after the handler completes and
 * warns when it looks like a loop is issuing per-row reads. Also emits the
 * count as `X-Query-Count`, which is what the e2e suite asserts against — the
 * Phase 4 exit criterion is that the persona page aggregate stays at or below
 * eight operations, and a header makes that a one-line test rather than log
 * scraping.
 *
 * Development and test only. In production the header would leak
 * implementation detail for no benefit, and the slow-query log plus tracing
 * cover the same ground.
 *
 * Registered innermost among the interceptors, so it observes everything the
 * handler and the other interceptors did.
 */
@Injectable()
export class QueryCountInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueryCountInterceptor.name);
  private readonly enabled: boolean;

  // Reads the count straight off the request context rather than through
  // PrismaService: the count lives in AsyncLocalStorage, so injecting the
  // data-access service bought nothing but a dependency from common/ onto
  // infra/.
  constructor(config: ConfigService<Env, true>) {
    this.enabled = config.get('NODE_ENV', { infer: true }) !== 'production';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AppRequest>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const count = getDbContext().queryCount ?? 0;
        if (count === 0) return;

        // Guarded: a 304 from the cache interceptor has already sent headers.
        if (!response.headersSent) {
          response.setHeader('X-Query-Count', String(count));
        }

        if (count > QUERY_WARN_THRESHOLD) {
          // One line per request, not per query, or a single N+1 would
          // produce a hundred identical warnings.
          this.logger.warn(
            `n_plus_one_suspected requestId=${formatRequestId(request.id) ?? '-'} ` +
              `path=${request.originalUrl} queries=${String(count)} ` +
              `threshold=${String(QUERY_WARN_THRESHOLD)} — look for a missing include ` +
              'or a loop issuing per-row reads',
          );
        }
      }),
    );
  }
}
