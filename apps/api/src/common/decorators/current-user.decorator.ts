import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AppRequest, AuthUser } from '../types';

/**
 * Injects the authenticated principal.
 *
 * Returns `undefined` on a @Public() route, so the type is deliberately
 * `AuthUser | undefined` and callers must narrow. Typing it as non-optional
 * would be a lie on every public endpoint.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AppRequest>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
