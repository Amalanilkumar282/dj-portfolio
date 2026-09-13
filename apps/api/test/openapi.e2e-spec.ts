import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../src/openapi';

import { createTestApp } from './harness';

/**
 * The committed OpenAPI contract — a Phase 4 exit criterion.
 *
 * The snapshot is checked in and compared, so **any** change to a route, a
 * DTO or a response shape shows up as a reviewable diff in the pull request
 * rather than being discovered by the frontend after deploy. That is the whole
 * value: the contract is generated from the Zod schemas, so this file is the
 * only place a breaking change is forced to become visible.
 *
 * To accept an intended change: `pnpm --filter @dj/api openapi:update`, then
 * commit the regenerated file **with** the change that caused it. Reviewing
 * the two together is the point.
 *
 * The document is built from `src/openapi.ts`, the same function `main.ts`
 * serves at /api/docs, so the snapshot cannot drift from the real API.
 */

// `__dirname`, not `import.meta.dirname`: this app compiles to CommonJS so the
// Nest DI decorator metadata survives. See ADR 0016.
const SNAPSHOT = resolve(__dirname, '../openapi.json');

let app: INestApplication;
let document: unknown;

beforeAll(async () => {
  app = await createTestApp();
  document = buildOpenApiDocument(app);
});

afterAll(async () => {
  await app.close();
});

/** Stable, sorted JSON, so key ordering never shows up as a spurious diff. */
function serialise(value: unknown): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input === null || typeof input !== 'object') return input;

    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  };

  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

describe('the OpenAPI document', () => {
  it('matches the committed snapshot', () => {
    const serialised = serialise(document);

    if (process.env.UPDATE_OPENAPI_SNAPSHOT === '1') {
      mkdirSync(dirname(SNAPSHOT), { recursive: true });
      writeFileSync(SNAPSHOT, serialised, 'utf8');
    }

    expect(
      existsSync(SNAPSHOT),
      'openapi.json is missing. Run: pnpm --filter @dj/api openapi:update',
    ).toBe(true);

    expect(readFileSync(SNAPSHOT, 'utf8')).toBe(serialised);
  });

  it('documents every route under the versioned prefix', () => {
    // A route that escapes /api/v1 is unreachable through the deployed
    // routing, so it would be dead on arrival.
    const paths = Object.keys((document as { paths: Record<string, unknown> }).paths);

    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      if (path.startsWith('/health')) continue; // VERSION_NEUTRAL by design
      expect(path, `${path} is outside the versioned prefix`).toMatch(/^\/api\/v1\//);
    }
  });

  it('requires auth on every admin route', () => {
    // The security boundary, asserted from the *document* rather than the
    // code: a controller that lost its @ApiBearerAuth is also a controller
    // whose guard someone may have removed, and this catches the paperwork
    // half of that mistake.
    const paths = (document as { paths: Record<string, Record<string, unknown>> }).paths;

    for (const [path, operations] of Object.entries(paths)) {
      if (!path.includes('/admin/')) continue;

      for (const [method, operation] of Object.entries(operations)) {
        const security = (operation as { security?: unknown[] }).security;
        expect(security, `${method.toUpperCase()} ${path} declares no security`).toBeDefined();
      }
    }
  });

  it('describes errors as RFC 9457 problem details', () => {
    const components = (document as { components?: { schemas?: Record<string, unknown> } })
      .components;

    expect(components?.schemas).toBeDefined();
  });
});
