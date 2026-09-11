import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import { runWithDbContextSync } from '@dj/db';

import { REQUEST_ID_HEADER } from '../constants';
import { RequestContextService } from '../services/request-context.service';
import type { AppRequest } from '../types';

/**
 * Opens the ambient request context for the whole request.
 *
 * **This is middleware, not an interceptor, and that matters.** Express
 * middleware wraps every downstream guard, interceptor and handler inside its
 * `next()` callback, so the AsyncLocalStorage scope reliably covers all of
 * them. An interceptor returns an Observable that Nest subscribes to *later*,
 * outside the scope — which would leave the context missing during handler
 * execution and silently drop every audit stamp.
 *
 * Middleware runs before the auth guards, so `userId` is not known yet. Both
 * stores are therefore opened with a mutable object, and `JwtAccessGuard`
 * fills in the actor once it has verified the token. See
 * `attachActorToContext` below, which is the only sanctioned way to do that.
 *
 * Two stores are opened because `@dj/db` owns its own AsyncLocalStorage: its
 * Prisma extensions read from that one, and the API reads from
 * `RequestContextService`. Nesting them here is what removes the actor
 * parameter from every service signature.
 *
 * See docs/02-architecture/backend.md
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(request: AppRequest, response: Response, next: NextFunction): void {
    // Honour an inbound correlation id so a trace survives across services,
    // and always echo it — that is what makes a user-reported error findable.
    const inbound = request.headers[REQUEST_ID_HEADER];
    const requestId = (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();

    request.id = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    runWithDbContextSync({ requestId }, () => {
      this.context.run(
        {
          requestId,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        },
        () => {
          next();
        },
      );
    });
  }
}
