import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Blog posts — the one publishable module with a real M:N relation
 * (`PostTag`), mirroring `Playlist`'s `setTracks`/`Brand`'s `setPersonas`
 * "replace wholesale, preserve order" pattern.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-posts';

let app: INestApplication;
let prisma: PrismaService;
let ownerToken = '';

const http = () => client(app);

async function cleanup(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.post.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.client.tag.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  });
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await cleanup();

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({ email: requiredEnv('ADMIN_SEED_EMAIL'), password: requiredEnv('ADMIN_SEED_PASSWORD') })
    .expect(200);

  ownerToken = `Bearer ${String(body(owner).accessToken)}`;
});

afterAll(async () => {
  await cleanup();
  await app.close();
});

describe('Post', () => {
  it('publishes, tags, filters by tag, then replaces the tag set', async () => {
    const tagA = body(
      await http()
        .post(`${base}/admin/tags`)
        .set('authorization', ownerToken)
        .send({ name: `${PREFIX}-tag-a`, slug: `${PREFIX}-tag-a` })
        .expect(201),
    ) as { slug: string };

    const tagB = body(
      await http()
        .post(`${base}/admin/tags`)
        .set('authorization', ownerToken)
        .send({ name: `${PREFIX}-tag-b`, slug: `${PREFIX}-tag-b` })
        .expect(201),
    ) as { slug: string };

    const created = await http()
      .post(`${base}/admin/posts`)
      .set('authorization', ownerToken)
      .send({
        title: `${PREFIX} Behind the Decks`,
        content: { type: 'doc', content: [] },
        status: 'PUBLISHED',
        tagSlugs: [tagA.slug],
      })
      .expect(201);

    const post = body(created) as { id: string; slug: string; tags: { slug: string }[] };
    expect(post.tags.map((t) => t.slug)).toEqual([tagA.slug]);

    await http().get(`${base}/posts/${post.slug}`).expect(200);

    const filtered = await http().get(`${base}/posts?tagSlug=${tagA.slug}&limit=100`).expect(200);
    expect((body(filtered).data as { id: string }[]).some((p) => p.id === post.id)).toBe(true);

    const notFiltered = await http().get(`${base}/posts?tagSlug=${tagB.slug}&limit=100`).expect(200);
    expect((body(notFiltered).data as { id: string }[]).some((p) => p.id === post.id)).toBe(false);

    const updated = await http()
      .patch(`${base}/admin/posts/${post.id}`)
      .set('authorization', ownerToken)
      .send({ tagSlugs: [tagB.slug] })
      .expect(200);
    expect((body(updated).tags as { slug: string }[]).map((t) => t.slug)).toEqual([tagB.slug]);
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/posts/slugs`).expect(200);
  });
});
