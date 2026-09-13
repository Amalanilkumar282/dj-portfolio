import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { CSRF_COOKIE, REFRESH_COOKIE } from '../../../common/constants';
import type { Env } from '../../../config/env.schema';

/**
 * Sets and clears the auth cookies.
 *
 * The refresh cookie carries four properties that each close a specific
 * attack, and none of them are optional:
 *
 * - `httpOnly` — JavaScript cannot read it, so an XSS on the admin page
 *   cannot exfiltrate a long-lived credential.
 * - `secure` — never sent over plain HTTP (relaxed only in development,
 *   where there is no TLS).
 * - `sameSite: 'strict'` — a cross-site request cannot carry it, which is
 *   what makes CSRF on the refresh endpoint impossible in any browser that
 *   honours it. `CsrfGuard` is the belt to this braces.
 * - `domain` scoped to `admin.djfelicitous.com` — the public origin never
 *   carries an admin session at all, so an XSS on a marketing page has
 *   nothing to steal. See
 *   docs/01-decisions/0002-separate-admin-app.md
 *
 * `path` is restricted to the auth routes: the cookie is only ever needed by
 * refresh and logout, so it is not attached to every admin API call.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE, token, {
      ...this.baseOptions(),
      httpOnly: true,
      expires: expiresAt,
      path: '/api/v1/auth',
    });
  }

  /**
   * Issues the CSRF double-submit token.
   *
   * Deliberately **not** httpOnly: the admin client has to read it in order to
   * echo it in the `x-csrf-token` header. That is safe because the token is
   * not a credential on its own — it is only meaningful alongside the
   * httpOnly refresh cookie, which script cannot read.
   */
  setCsrfCookie(response: Response, expiresAt: Date): string {
    const token = randomBytes(24).toString('base64url');

    response.cookie(CSRF_COOKIE, token, {
      ...this.baseOptions(),
      httpOnly: false,
      expires: expiresAt,
      path: '/',
    });

    return token;
  }

  clearAuthCookies(response: Response): void {
    // Options must match those used to set the cookie, or the browser keeps
    // the original — a clear with a different path or domain is a silent no-op.
    response.clearCookie(REFRESH_COOKIE, {
      ...this.baseOptions(),
      httpOnly: true,
      path: '/api/v1/auth',
    });

    response.clearCookie(CSRF_COOKIE, {
      ...this.baseOptions(),
      httpOnly: false,
      path: '/',
    });
  }

  private baseOptions(): CookieOptions {
    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });

    return {
      // No TLS in local development, so `secure` would drop the cookie.
      secure: isProduction,
      sameSite: 'strict',
      signed: false,
      // `localhost` must be left undefined: browsers reject an explicit
      // domain attribute for it and the cookie is silently discarded.
      ...(domain && domain !== 'localhost' ? { domain } : {}),
    };
  }
}
