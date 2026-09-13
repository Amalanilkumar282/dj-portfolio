import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { base, body, createTestApp, http as client, readCookie, requiredEnv } from './harness';

/**
 * Auth end-to-end.
 *
 * This is the Phase 3 exit criterion. The behaviours asserted here are the
 * ones that are easy to break by accident and expensive to break in
 * production:
 *
 * - no user enumeration
 * - deny-by-default on every route
 * - refresh rotation, and reuse revoking the whole token family
 * - RFC 9457 problem responses with a traceable requestId
 *
 * Requires a running Postgres with migrations applied and `seed:system` plus
 * `seed:admin` run. See docs/05-operations/local-setup.md.
 */

const SEEDED_EMAIL = requiredEnv('ADMIN_SEED_EMAIL');
const SEEDED_PASSWORD = requiredEnv('ADMIN_SEED_PASSWORD');

let app: INestApplication;

/**
 * This spec's HTTP client. Each call gets a fresh address — see
 * `nextClientIp` in harness.ts for why that matters.
 */
const http = () => client(app);

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

/** Signs in as the seeded owner and returns the response. */
async function login() {
  return http()
    .post(`${base}/auth/login`)
    .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
    .expect(200);
}

describe('deny by default', () => {
  it('rejects an unauthenticated request to a protected route', async () => {
    const response = await http().get(`${base}/auth/me`).expect(401);

    // No credential at all: nothing to refresh, so the client must sign in.
    expect(body(response).code).toBe('AUTH_REQUIRED');
  });

  it('distinguishes a bad access token from a missing one', async () => {
    // The admin client silently refreshes on ACCESS_TOKEN_INVALID and
    // redirects to login on AUTH_REQUIRED, so these must not collapse into
    // one code.
    const response = await http()
      .get(`${base}/auth/me`)
      .set('authorization', 'Bearer not-a-jwt')
      .expect(401);

    expect(body(response).code).toBe('ACCESS_TOKEN_INVALID');
  });

  it('rejects an unauthenticated admin read', async () => {
    await http().get(`${base}/admin/personas`).expect(401);
  });

  it('allows a public route through', async () => {
    await http().get(`${base}/personas`).expect(200);
  });
});

describe('problem details', () => {
  it('returns application/problem+json with a traceable requestId', async () => {
    const response = await http()
      .get(`${base}/auth/me`)
      .set('x-request-id', 'e2e-trace-me')
      .expect(401);

    expect(response.headers['content-type']).toContain('application/problem+json');
    // The inbound id is honoured, which is what makes a user-reported error
    // findable in the logs.
    expect(body(response).requestId).toBe('e2e-trace-me');
    expect(body(response).type).toContain('/problems/');
    expect(body(response).status).toBe(401);
  });

  it('returns field errors as JSON Pointers, and a 422', async () => {
    // 422, not 400: api-conventions.md reserves 400 for a request the server
    // could not parse. nestjs-zod's stock pipe throws 400 with raw Zod issues,
    // which is why the pipe is wrapped — see common/pipes/zod-validation.pipe.
    const response = await http()
      .post(`${base}/auth/login`)
      .send({ email: 'not-an-email' })
      .expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');

    const errors = body(response).errors ?? [];
    expect(errors.map((error) => error.pointer)).toEqual(
      expect.arrayContaining(['/email', '/password']),
    );
    // Raw Zod internals must not reach the client.
    expect(errors[0]).not.toHaveProperty('path');
    expect(errors[0]).not.toHaveProperty('expected');
  });

  it('rejects an unknown property rather than silently stripping it', async () => {
    // Silent stripping is how a frontend ships a bug nobody can reproduce.
    const response = await http()
      .post(`${base}/auth/login`)
      .send({ email: 'a@b.co', password: 'x'.repeat(12), isAdmin: true })
      .expect(422);

    expect(body(response).errors?.[0]?.code).toBe('unrecognized_keys');
  });
});

describe('login', () => {
  it('returns an identical response for a wrong password and an unknown email', async () => {
    // The no-enumeration guarantee. Paired with `burnVerifyTime()` in
    // AuthService, which equalises the timing too.
    const wrongPassword = await http()
      .post(`${base}/auth/login`)
      .send({ email: SEEDED_EMAIL, password: 'definitely-not-the-password' })
      .expect(401);

    const unknownEmail = await http()
      .post(`${base}/auth/login`)
      .send({ email: 'nobody-at-all@example.com', password: 'definitely-not-the-password' })
      .expect(401);

    expect(body(wrongPassword).detail).toBe(body(unknownEmail).detail);
    expect(body(wrongPassword).code).toBe(body(unknownEmail).code);
    expect(body(wrongPassword).status).toBe(body(unknownEmail).status);
  });

  it('issues an access token, a refresh cookie and a CSRF cookie', async () => {
    const response = await login();
    const payload = body(response);

    expect(payload.accessToken).toBeTypeOf('string');

    const user = payload.user as { email: string; permissions: string[] };
    expect(user.email).toBe(SEEDED_EMAIL);
    expect(user.permissions.length).toBeGreaterThan(0);

    expect(readCookie(response.headers, 'dj_rt')).toBeDefined();
    expect(readCookie(response.headers, 'dj_csrf')).toBeDefined();
  });

  it('marks the refresh cookie HttpOnly, so script can never read it', async () => {
    const response = await login();
    const cookies = (response.headers['set-cookie'] as string[] | undefined) ?? [];

    const refresh = cookies.find((cookie) => cookie.startsWith('dj_rt='));
    expect(refresh).toBeDefined();
    expect(refresh?.toLowerCase()).toContain('httponly');
    // The CSRF cookie is the opposite: script MUST read it to echo it back.
    expect(cookies.find((cookie) => cookie.startsWith('dj_csrf='))?.toLowerCase()).not.toContain(
      'httponly',
    );
  });

  it('never caches an auth response', async () => {
    const response = await login();

    // An auth response in any cache is a session-hijacking primitive.
    expect(response.headers['cache-control']).toContain('no-store');
  });
});

describe('rate limiting', () => {
  it('throttles repeated login attempts from one address', async () => {
    // Pins a single address on purpose — the rest of the suite deliberately
    // spreads addresses so it does not throttle itself, which would leave
    // this behaviour untested. This is the per-IP half of the brute-force
    // defence; the per-account exponential lockout in AuthService is the
    // other half, and covers an attacker rotating addresses.
    const attacker = client(app, '198.51.100.254');
    const attempt = () =>
      attacker
        .post(`${base}/auth/login`)
        .set('x-forwarded-for', '198.51.100.254')
        .send({ email: 'nobody@example.test', password: 'wrong-password-here' });

    const statuses: number[] = [];
    // The limit is 10 per 15 minutes, so 12 attempts must reach it.
    for (let i = 0; i < 12; i += 1) {
      statuses.push((await attempt()).status);
    }

    expect(statuses).toContain(429);
    // And it must be the *later* attempts that are refused, not the first —
    // otherwise the limit is misconfigured rather than working.
    expect(statuses[0]).toBe(401);
  });
});

describe('token rotation and reuse detection', () => {
  it('rotates the refresh token and revokes the whole family on reuse', async () => {
    const first = await login();
    const firstToken = readCookie(first.headers, 'dj_rt')!;
    const firstCsrf = readCookie(first.headers, 'dj_csrf')!;

    // --- rotate -----------------------------------------------------------
    const rotated = await http()
      .post(`${base}/auth/refresh`)
      .set('cookie', `dj_rt=${firstToken}; dj_csrf=${firstCsrf}`)
      .set('x-csrf-token', firstCsrf)
      .expect(200);

    const secondToken = readCookie(rotated.headers, 'dj_rt')!;
    const secondCsrf = readCookie(rotated.headers, 'dj_csrf')!;

    expect(secondToken).toBeDefined();
    expect(secondToken).not.toBe(firstToken);

    // --- replay the spent token -------------------------------------------
    const replayed = await http()
      .post(`${base}/auth/refresh`)
      .set('cookie', `dj_rt=${firstToken}; dj_csrf=${secondCsrf}`)
      .set('x-csrf-token', secondCsrf)
      .expect(401);

    expect(body(replayed).code).toBe('REFRESH_TOKEN_REUSED');

    // --- the legitimate token is now dead too -----------------------------
    // Two parties held the spent token and there is no way to tell which was
    // the attacker, so the correct response is to burn the whole lineage.
    const afterRevoke = await http()
      .post(`${base}/auth/refresh`)
      .set('cookie', `dj_rt=${secondToken}; dj_csrf=${secondCsrf}`)
      .set('x-csrf-token', secondCsrf)
      .expect(401);

    expect(body(afterRevoke).code).toBe('REFRESH_TOKEN_REUSED');
  });

  it('rejects a refresh with no CSRF header', async () => {
    const session = await login();
    const token = readCookie(session.headers, 'dj_rt')!;
    const csrf = readCookie(session.headers, 'dj_csrf')!;

    const response = await http()
      .post(`${base}/auth/refresh`)
      .set('cookie', `dj_rt=${token}; dj_csrf=${csrf}`)
      .expect(403);

    expect(body(response).code).toBe('CSRF_FAILED');
  });

  it('rejects a refresh whose CSRF header does not match the cookie', async () => {
    const session = await login();
    const token = readCookie(session.headers, 'dj_rt')!;
    const csrf = readCookie(session.headers, 'dj_csrf')!;

    await http()
      .post(`${base}/auth/refresh`)
      .set('cookie', `dj_rt=${token}; dj_csrf=${csrf}`)
      .set('x-csrf-token', 'a-different-value-entirely')
      .expect(403);
  });

  it('rejects an unknown refresh token', async () => {
    await http()
      .post(`${base}/auth/refresh`)
      .set('cookie', 'dj_rt=completely-made-up; dj_csrf=abc')
      .set('x-csrf-token', 'abc')
      .expect(401);
  });
});

describe('authenticated access', () => {
  it('resolves the current user with fresh permissions', async () => {
    const session = await login();

    const response = await http()
      .get(`${base}/auth/me`)
      .set('authorization', `Bearer ${String(body(session).accessToken)}`)
      .expect(200);

    const me = body(response);
    expect(me.email).toBe(SEEDED_EMAIL);
    expect(me.roles as string[]).toContain('SUPER_ADMIN');
    // Read from the database rather than off the token, so a role change
    // shows in the admin UI without waiting for expiry.
    expect((me.permissions as string[]).length).toBeGreaterThan(50);
  });

  it('logs out idempotently, even with no session', async () => {
    // Logging out must work with an expired token, or a lapsed session cannot
    // be cleared.
    await http().post(`${base}/auth/logout`).expect(204);
  });
});
