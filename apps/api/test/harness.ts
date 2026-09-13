import type { Server } from 'node:http';

import { type INestApplication, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * Shared e2e bootstrap.
 *
 * Exists for two reasons beyond deduplication:
 *
 * 1. **It mirrors `main.ts`.** The global prefix and URI versioning must match
 *    production, or the suite exercises paths that do not exist there — a test
 *    run that is green about the wrong routes.
 * 2. **It types `getHttpServer()`.** Nest declares it as `any`, so every
 *    `request(app.getHttpServer())` is an unchecked call that also defeats
 *    lint's type-aware rules across the whole spec.
 *
 * Anything added to `main.ts` that changes routing or cookie handling must be
 * added here too.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  // Typed as the Express application, like main.ts, because `app.set` is an
  // Express-adapter method rather than part of the platform-agnostic surface.
  const app = moduleRef.createNestApplication<NestExpressApplication>();

  // Mirrors main.ts: one trusted proxy hop, so `req.ip` comes from
  // X-Forwarded-For exactly as it does behind Railway's router. Without it the
  // per-IP throttler and the audit trail see the socket address instead, and
  // neither is exercised the way it runs in production.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  await app.init();

  return app;
}

let ipCounter = 0;

/**
 * A fresh client address.
 *
 * Rate limits are per-IP and the throttler's counters are process-wide, so a
 * whole suite sharing one address throttles *itself*: the specs' own request
 * volume trips the 30-per-10s window and unrelated assertions fail as 429s
 * that look like flakiness. Handing out a new address per call removes that
 * artifact without weakening the limits — a spec that means to assert the
 * limit pins a single address deliberately and still sees it enforced.
 *
 * Drawn from 198.51.100.0/24, reserved for documentation by RFC 5737.
 */
export function nextClientIp(): string {
  ipCounter += 1;
  return `198.51.100.${String((ipCounter % 250) + 1)}`;
}

/** The verbs the specs use, each pre-stamped with the client address. */
export interface TestClient {
  get(url: string): request.Test;
  post(url: string): request.Test;
  patch(url: string): request.Test;
  put(url: string): request.Test;
  delete(url: string): request.Test;
}

/**
 * A typed supertest client for the booted app, reporting a given client IP.
 *
 * Written out verb by verb rather than proxying the agent: supertest's `Agent`
 * has no per-agent default-header hook, and a Proxy over it loses the return
 * types, which quietly turns every assertion in every spec into an unchecked
 * `any`.
 */
export function http(app: INestApplication, ip = nextClientIp()): TestClient {
  const server = app.getHttpServer() as Server;
  const withIp = (test: request.Test): request.Test => test.set('x-forwarded-for', ip);

  return {
    get: (url) => withIp(request(server).get(url)),
    post: (url) => withIp(request(server).post(url)),
    patch: (url) => withIp(request(server).patch(url)),
    put: (url) => withIp(request(server).put(url)),
    delete: (url) => withIp(request(server).delete(url)),
  };
}

/** The versioned API root. Every spec builds paths from this. */
export const base = '/api/v1';

/**
 * A response body, as an indexable record.
 *
 * supertest types `body` as `any`. Narrowing it at the boundary keeps the
 * type-aware lint rules working inside the specs instead of turning every
 * assertion into an unchecked member access.
 */
export type ResponseBody = Record<string, unknown> & {
  data?: unknown;
  meta?: Record<string, unknown>;
  errors?: { pointer: string; code?: string; message: string }[];
};

export function body(response: { body: unknown }): ResponseBody {
  return response.body as ResponseBody;
}

/**
 * An environment variable the suite cannot run without.
 *
 * Thrown rather than defaulted: a wrong fallback credential fails as a wall of
 * 401s that read like an auth bug instead of a missing variable.
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set to run the e2e suite. See docs/05-operations/local-setup.md`,
    );
  }
  return value;
}

/** Reads one cookie value out of a Set-Cookie header. */
export function readCookie(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers['set-cookie'];
  const list: string[] = Array.isArray(raw)
    ? (raw as unknown[]).map((entry) => String(entry))
    : typeof raw === 'string'
      ? [raw]
      : [];

  for (const entry of list) {
    const match = new RegExp(`${name}=([^;]+)`).exec(entry);
    if (match?.[1]) return match[1];
  }

  return undefined;
}
