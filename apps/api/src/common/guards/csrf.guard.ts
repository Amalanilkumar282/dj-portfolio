import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { CSRF_COOKIE, CSRF_HEADER, REFRESH_COOKIE } from '../constants';
import { readCookies } from '../cookies';
import { ERROR_CODES } from '../problems';
import type { AppRequest } from '../types';

/** Methods that cannot change state and therefore need no CSRF check. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated writes.
 *
 * Only relevant to requests that authenticate via the **refresh cookie** —
 * `POST /auth/refresh` and `POST /auth/logout`. Everything else authenticates
 * with a `Authorization: Bearer` header, which a cross-site form cannot set,
 * so it is inherently immune.
 *
 * The refresh cookie is already `SameSite=Strict`, which blocks the attack on
 * its own in every browser that honours it. This is defence in depth for the
 * case where it does not: a stale browser, or a future change to `SameSite`
 * that someone makes without thinking it through.
 *
 * Applied explicitly with `@UseGuards(CsrfGuard)` rather than globally,
 * because on a Bearer-authenticated route it would only reject legitimate
 * clients for no gain.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();

    if (SAFE_METHODS.has(request.method)) return true;

    // Without the refresh cookie there is no cookie-borne authority to abuse.
    const cookies = readCookies(request);
    if (!cookies[REFRESH_COOKIE]) return true;

    const cookieToken = cookies[CSRF_COOKIE];
    const headerValue = request.headers[CSRF_HEADER];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!cookieToken || !headerToken || !this.matches(cookieToken, headerToken)) {
      throw new ForbiddenException({
        message: 'CSRF token missing or invalid.',
        code: ERROR_CODES.CSRF_FAILED,
      });
    }

    return true;
  }

  /** Constant-time compare, so the check leaks nothing through timing. */
  private matches(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    // timingSafeEqual throws on a length mismatch, so that is checked first.
    // The length itself is not secret.
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
