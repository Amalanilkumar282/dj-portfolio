import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { DEFAULT_TIMEOUT_MS, TIMEOUT_KEY } from '../constants';
import { ERROR_CODES } from '../problems';

/**
 * Caps handler duration.
 *
 * Without this a single slow query holds a connection and a socket
 * indefinitely, and enough of them exhaust the Neon connection pool — turning
 * one slow endpoint into a site-wide outage. Failing at 15 seconds with a
 * clear 408 is strictly better than hanging.
 *
 * Override per route with `@Timeout(ms)` for genuinely long work, such as
 * press-kit PDF generation. A handler that needs more than a few seconds is
 * usually a background job in disguise.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms =
      this.reflector.getAllAndOverride<number | undefined>(TIMEOUT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_TIMEOUT_MS;

    return next.handle().pipe(
      timeout(ms),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new RequestTimeoutException({
                message: `The request did not complete within ${String(ms)}ms.`,
                code: ERROR_CODES.REQUEST_TIMEOUT,
              })
            : error,
        ),
      ),
    );
  }
}
