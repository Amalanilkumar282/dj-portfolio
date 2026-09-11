import { createHash } from 'node:crypto';

import {
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { type Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { IDEMPOTENT_KEY } from '../constants';
import { ERROR_CODES } from '../problems';
import { IdempotencyRepository } from '../services/idempotency.repository';
import type { AppRequest } from '../types';

/** How long a key is honoured for replay. */
const TTL_HOURS = 24;

/**
 * Implements the `Idempotency-Key` header.
 *
 * The failure this prevents is concrete: a booking enquiry submitted twice
 * because the visitor double-tapped, or because a flaky mobile connection
 * retried a request that had already succeeded. The artist then sees two
 * enquiries for one event and cannot tell which is real.
 *
 * Semantics:
 *
 * - Same key, same body    -> the stored response is replayed, with
 *                             `Idempotency-Replayed: true`.
 * - Same key, DIFFERENT body -> 409. This is a client bug, and silently
 *                             accepting it would hide a far worse problem.
 * - No key                 -> passes through. Routes that must be protected
 *                             regardless carry their own dedupe, as
 *                             `POST /inquiries` does.
 *
 * Opt in per route with `@Idempotent()`.
 *
 * See docs/02-architecture/api-conventions.md
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly repository: IdempotencyRepository,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const enabled = this.reflector.getAllAndOverride<boolean | undefined>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!enabled) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AppRequest>();
    const response = http.getResponse<Response>();

    const header = request.headers['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;

    // The header is optional. Requiring it would break every plain HTML form
    // and every curl-driven integration for no security gain.
    if (!key) return next.handle();

    const requestHash = createHash('sha256')
      .update(`${request.method}:${request.path}:${JSON.stringify(request.body ?? {})}`)
      .digest('hex');

    const existing = await this.repository.find(key);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          message: 'This Idempotency-Key was already used with a different request body.',
          code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        });
      }

      response.status(existing.statusCode);
      response.setHeader('Idempotency-Replayed', 'true');
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((body: unknown) => {
        // Recorded only on success. A failed request must be retryable with
        // the same key, or a transient 500 would permanently block the retry.
        void this.repository.record({
          key,
          requestHash,
          statusCode: response.statusCode,
          responseBody: body,
          userId: request.user?.sub,
          path: request.path,
          expiresAt: new Date(Date.now() + TTL_HOURS * 3_600_000),
        });
      }),
    );
  }
}
