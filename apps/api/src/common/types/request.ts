import type { Request } from 'express';

/**
 * The authenticated principal attached to a request by JwtAccessGuard.
 *
 * Permissions are flattened onto the token at login so PermissionsGuard needs
 * no database round trip per request. The trade-off is that a role change does
 * not take effect until the access token expires (15 minutes) or the user
 * refreshes; that is acceptable and documented, and `logout-all` forces it
 * immediately when a change must be urgent.
 */
export interface AuthUser {
  /** User id. Named `sub` to match the JWT claim it comes from. */
  sub: string;
  email: string;
  roles: string[];
  /** Flattened `resource:action` strings. */
  permissions: string[];
  /** Issued-at, used to reject tokens older than passwordChangedAt. */
  iat?: number;
  exp?: number;
}

/**
 * Express request with what our guards attach.
 *
 * `id` is deliberately absent: pino-http augments Express's own `Request` with
 * a required `id`, so redeclaring it here as optional is a conflict. It is
 * always populated — `RequestContextMiddleware` sets it before anything else
 * runs.
 */
export interface AppRequest extends Request {
  user?: AuthUser | undefined;
}
