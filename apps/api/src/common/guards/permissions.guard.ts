import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../constants';
import { ERROR_CODES } from '../problems';
import type { AppRequest } from '../types';

/**
 * Enforces `@RequirePermissions()`.
 *
 * Runs after `JwtAccessGuard`, so a principal is already attached. Permissions
 * are flattened onto the access token at login, which means no database round
 * trip per request — at the cost of a role change taking up to the token
 * lifetime (15 minutes) to apply. `logout-all` forces it immediately when a
 * revocation is urgent.
 *
 * **This is the enforcement point.** The admin UI hides what a user cannot do,
 * but that is UX; a hidden button is not a control.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No declared permissions means authentication alone is enough. That is
    // correct for routes like `GET /auth/me`.
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<AppRequest>().user;

    if (!user) {
      throw new UnauthorizedException({
        message: 'Authentication required.',
        code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    }

    const held = new Set(user.permissions);
    const missing = required.filter((permission) => !held.has(permission));

    if (missing.length > 0) {
      // The missing permissions are named on purpose. This endpoint is only
      // reachable by an authenticated admin, and telling an editor exactly
      // which grant they lack turns a support conversation into a one-liner.
      throw new ForbiddenException({
        message: `Missing required permission(s): ${missing.join(', ')}.`,
        code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      });
    }

    return true;
  }
}
