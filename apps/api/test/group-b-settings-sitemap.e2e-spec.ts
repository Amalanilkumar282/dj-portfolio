import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * `SiteSettings` (the singleton) and the sitemap aggregate.
 *
 * Settings has no create/delete/list — every write is a `PATCH` against the
 * one row a database `CHECK (id = 'singleton')` constraint enforces. The
 * test restores whatever it changes so the artist's real settings are never
 * left mutated, the same convention `testing.md` requires of every spec.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

let app: INestApplication;
let ownerToken = '';

const http = () => client(app);

beforeAll(async () => {
  app = await createTestApp();

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({ email: requiredEnv('ADMIN_SEED_EMAIL'), password: requiredEnv('ADMIN_SEED_PASSWORD') })
    .expect(200);

  ownerToken = `Bearer ${String(body(owner).accessToken)}`;
});

afterAll(async () => {
  await app.close();
});

describe('Settings', () => {
  it('reads publicly, and a PATCH round-trips then is restored', async () => {
    const before = await http().get(`${base}/settings`).expect(200);
    const originalTagline = body(before).siteTagline as string | null;

    const patched = await http()
      .patch(`${base}/admin/settings`)
      .set('authorization', ownerToken)
      .send({ siteTagline: 'e2e-groupb-temp-tagline' })
      .expect(200);
    expect(body(patched).siteTagline).toBe('e2e-groupb-temp-tagline');

    const after = await http().get(`${base}/settings`).expect(200);
    expect(body(after).siteTagline).toBe('e2e-groupb-temp-tagline');

    await http()
      .patch(`${base}/admin/settings`)
      .set('authorization', ownerToken)
      .send({ siteTagline: originalTagline })
      .expect(200);
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/settings`).expect(401);
  });
});

describe('Sitemap', () => {
  it('lists published, indexable URLs across resource types', async () => {
    const response = await http().get(`${base}/sitemap`).expect(200);

    const entries = body(response).data as { loc: string; lastmod: string }[];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => typeof e.loc === 'string' && e.loc.startsWith('http'))).toBe(true);
  });
});
