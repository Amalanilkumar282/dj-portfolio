import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Smoke coverage for Group B's taxonomy-like resources: `Stat`, `Redirect`
 * and `Tag`. None have a publish workflow; `Tag` additionally guards its
 * delete the way `Genre` does, since `PostTag` cascades.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-groupb-tax';
const STAT_PREFIX = 'e2e_groupb_tax';

let app: INestApplication;
let prisma: PrismaService;
let ownerToken = '';

const http = () => client(app);

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({ email: requiredEnv('ADMIN_SEED_EMAIL'), password: requiredEnv('ADMIN_SEED_PASSWORD') })
    .expect(200);

  ownerToken = `Bearer ${String(body(owner).accessToken)}`;
});

afterAll(async () => {
  await prisma.client.stat.deleteMany({ where: { key: { startsWith: STAT_PREFIX } } });
  await prisma.client.redirect.deleteMany({ where: { fromPath: { startsWith: `/${PREFIX}` } } });
  await prisma.client.tag.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await app.close();
});

describe('Stat', () => {
  it('creates, lists publicly, rejects a duplicate key for the same (null) persona, deletes', async () => {
    const created = await http()
      .post(`${base}/admin/stats`)
      .set('authorization', ownerToken)
      .send({ key: `${STAT_PREFIX}_gigs`, label: 'Gigs Played', value: '500+' })
      .expect(201);

    const stat = body(created) as { id: string };

    const list = await http().get(`${base}/stats?limit=100`).expect(200);
    expect((body(list).data as { id: string }[]).some((s) => s.id === stat.id)).toBe(true);

    const dup = await http()
      .post(`${base}/admin/stats`)
      .set('authorization', ownerToken)
      .send({ key: `${STAT_PREFIX}_gigs`, label: 'Duplicate', value: '1' })
      .expect(409);
    expect(body(dup).code).toBe('UNIQUE_CONSTRAINT');

    await http().delete(`${base}/admin/stats/${stat.id}`).set('authorization', ownerToken).expect(204);
  });
});

describe('Redirect', () => {
  it('creates, appears in the active list, rejects a self-redirect, deletes', async () => {
    const selfRedirect = await http()
      .post(`${base}/admin/redirects`)
      .set('authorization', ownerToken)
      .send({ fromPath: `/${PREFIX}-loop`, toPath: `/${PREFIX}-loop` })
      .expect(422);
    expect(body(selfRedirect).code).toBe('VALIDATION_FAILED');

    const created = await http()
      .post(`${base}/admin/redirects`)
      .set('authorization', ownerToken)
      .send({ fromPath: `/${PREFIX}-old`, toPath: `/${PREFIX}-new` })
      .expect(201);

    const redirect = body(created) as { id: string };

    const active = await http().get(`${base}/redirects`).expect(200);
    expect((body(active).data as { id: string }[]).some((r) => r.id === redirect.id)).toBe(true);

    await http()
      .delete(`${base}/admin/redirects/${redirect.id}`)
      .set('authorization', ownerToken)
      .expect(204);
  });
});

describe('Tag', () => {
  it('refuses to delete a tag still used by a post, then allows it once untagged', async () => {
    const tag = body(
      await http()
        .post(`${base}/admin/tags`)
        .set('authorization', ownerToken)
        .send({ name: `${PREFIX}-production` })
        .expect(201),
    ) as { id: string; slug: string };

    const post = body(
      await http()
        .post(`${base}/admin/posts`)
        .set('authorization', ownerToken)
        .send({ title: `${PREFIX} post`, tagSlugs: [tag.slug] })
        .expect(201),
    ) as { id: string };

    const blocked = await http()
      .delete(`${base}/admin/tags/${tag.id}`)
      .set('authorization', ownerToken)
      .expect(409);
    expect(body(blocked).code).toBe('GENRE_IN_USE');

    await http()
      .patch(`${base}/admin/posts/${post.id}`)
      .set('authorization', ownerToken)
      .send({ tagSlugs: [] })
      .expect(200);

    await http().delete(`${base}/admin/tags/${tag.id}`).set('authorization', ownerToken).expect(204);

    const { runWithHardDelete } = await import('@dj/db');
    await runWithHardDelete(async () => {
      await prisma.client.post.deleteMany({ where: { id: post.id } });
    });
  });
});
