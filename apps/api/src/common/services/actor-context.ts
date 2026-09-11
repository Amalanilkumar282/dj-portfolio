import { getDbContext } from '@dj/db';

import type { AuthUser } from '../types';

import type { RequestContextService } from './request-context.service';

/**
 * Attaches the authenticated actor to the already-open request context.
 *
 * `RequestContextMiddleware` opens both AsyncLocalStorage scopes before the
 * guards run, so at that point there is no `userId` to record. Once
 * `JwtAccessGuard` has verified a token, this fills it in by mutating the live
 * store rather than opening a second nested scope — nesting would not work,
 * because a guard cannot wrap the downstream handler the way middleware can.
 *
 * The mutation is the point, and it is why `getDbContext()` returns a live
 * reference. Called from exactly one place: `JwtAccessGuard`.
 */
export function attachActorToContext(requestContext: RequestContextService, user: AuthUser): void {
  const apiContext = requestContext.get();
  if (apiContext) {
    apiContext.userId = user.sub;
    apiContext.userEmail = user.email;
  }

  // Drives createdBy / updatedBy stamping in the Prisma audit extension.
  const dbContext = getDbContext();
  dbContext.userId = user.sub;
}
