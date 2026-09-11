import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Media pipeline and press-kit surfaces that can be exercised **without**
 * live Cloudinary credentials — signing is pure local computation, and
 * every call that needs an actual round trip to Cloudinary (`confirm`,
 * gated downloads, EPK generation) is asserted to fail the way
 * `CloudinaryService.assertConfigured()` promises: a clean 503, not a
 * crash. What those paths do with real credentials is not verified here —
 * see STATUS.md.
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

describe('Media upload signature, unconfigured Cloudinary', () => {
  it('503s cleanly rather than signing a destination no upload can reach', async () => {
    const response = await http()
      .post(`${base}/admin/media/upload-signature`)
      .set('authorization', ownerToken)
      .send({ purpose: 'AVATAR', entityType: 'persona', resourceType: 'IMAGE', personaSlug: 'tnt' })
      .expect(503);

    expect(body(response).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('requires authentication regardless', async () => {
    await http()
      .post(`${base}/admin/media/upload-signature`)
      .send({ purpose: 'AVATAR', entityType: 'persona', resourceType: 'IMAGE' })
      .expect(401);
  });
});

describe('Media confirm, unconfigured Cloudinary', () => {
  it('503s cleanly rather than crashing on a network call it cannot make', async () => {
    const response = await http()
      .post(`${base}/admin/media`)
      .set('authorization', ownerToken)
      .send({ publicId: 'djf-dev/personas/tnt/avatar/does-not-exist', purpose: 'AVATAR', resourceType: 'IMAGE' })
      .expect(503);

    expect(body(response).code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('Media admin list', () => {
  it('lists, offset-paginated', async () => {
    const response = await http()
      .get(`${base}/admin/media?perPage=5`)
      .set('authorization', ownerToken)
      .expect(200);

    expect(body(response).meta?.pagination).toMatchObject({ mode: 'offset' });
  });
});

describe('Press kit', () => {
  it('lists publicly with no auth', async () => {
    await http().get(`${base}/press-kit`).expect(200);
  });

  it('EPK regeneration 503s cleanly without live Cloudinary credentials', async () => {
    const response = await http()
      .post(`${base}/admin/press-kit/epk/TNT/regenerate`)
      .set('authorization', ownerToken)
      .expect(503);

    expect(body(response).code).toBe('SERVICE_UNAVAILABLE');
  });
});
