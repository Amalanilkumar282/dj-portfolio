import { createHash } from 'node:crypto';

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CACHE_POLICY_KEY } from '../constants';
import { CACHE_POLICIES, type CachePolicy } from '../decorators/cache-policy.decorator';
import type { AppRequest } from '../types';

/**
 * Serialises a value with object keys in a stable order.
 *
 * A plain `JSON.stringify` is not usable for an ETag: Prisma does not
 * guarantee key order between queries, so the same logical response could hash
 * differently on consecutive requests and every conditional request would miss.
 */
function stableStringify(value: unknown): string {
  // `undefined` is checked before the general case because JSON.stringify
  // returns `undefined` (not a string) for it, which TypeScript's signature
  // does not admit.
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  const record = value as Record<string, unknown>;
  const body = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',');

  return `{${body}}`;
}

/**
 * Emits `Cache-Control` and a strong `ETag`, and answers `If-None-Match`
 * with 304.
 *
 * Defaults are chosen so that forgetting the decorator is safe:
 *
 * - every non-GET is `no-store`, unconditionally
 * - a GET with no declared policy is also `no-store`
 *
 * That direction is deliberate. An endpoint accidentally cached at the edge
 * can serve one visitor another visitor's data; an endpoint accidentally
 * uncached is merely slower.
 *
 * See docs/02-architecture/api-conventions.md
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AppRequest>();
    const response = http.getResponse<Response>();

    if (request.method !== 'GET') {
      response.setHeader('Cache-Control', CACHE_POLICIES.noStore.header);
      return next.handle();
    }

    const policy =
      this.reflector.getAllAndOverride<CachePolicy | undefined>(CACHE_POLICY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? CACHE_POLICIES.noStore;

    response.setHeader('Cache-Control', policy.header);
    // Responses vary by encoding, and by origin because CORS is credentialed.
    response.setHeader('Vary', 'Accept-Encoding, Origin');

    if (!policy.etag) return next.handle();

    return next.handle().pipe(
      map((body: unknown) => {
        if (body === undefined || body === null) return body;

        const etag = `"${createHash('sha1').update(stableStringify(body)).digest('base64url')}"`;
        response.setHeader('ETag', etag);

        if (request.headers['if-none-match'] === etag) {
          response.status(304);
          // Returning undefined makes Nest send an empty body, which is what
          // 304 requires — a body on a 304 is a protocol violation.
          return undefined;
        }

        return body;
      }),
    );
  }
}
