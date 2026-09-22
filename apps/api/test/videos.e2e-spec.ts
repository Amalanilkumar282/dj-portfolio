import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Videos — the module built from a Prisma model that had existed, unused,
 * since Phase 1.
 *
 * Structurally it is the standard publishable shape, so most of this mirrors
 * `programs.e2e-spec.ts`. What is specific to Videos, and what these tests
 * exist for, is the **provider invariant**: how a video is played depends on
 * where it is hosted, and the create and update paths enforce that rule in
 * two different places (a Zod refinement on create, a merged re-check in the
 * service on update, because a partial PATCH cannot see the stored fields).
 * A regression in either one stores a video the site cannot play.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-videos';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.video.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  });
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  await removeFixtures();

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({
      email: requiredEnv('ADMIN_SEED_EMAIL'),
      password: requiredEnv('ADMIN_SEED_PASSWORD'),
    })
    .expect(200);

  ownerToken = `Bearer ${String(body(owner).accessToken)}`;
});

afterAll(async () => {
  await removeFixtures();
  await app.close();
});

interface AdminVideo {
  id: string;
  slug: string;
  title: string;
  provider: string;
  providerVideoId: string | null;
  embedUrl: string | null;
  personaSlug: string | null;
  isFeatured: boolean;
}

async function withFixtureVideo(
  run: (video: AdminVideo) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/videos`)
    .set('authorization', ownerToken)
    .send({
      title: `${PREFIX} Temp Video`,
      slug: `${PREFIX}-temp`,
      provider: 'YOUTUBE',
      providerVideoId: 'dQw4w9WgXcQ',
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const video = body(created) as unknown as AdminVideo;

  try {
    await run(video);
  } finally {
    await runWithHardDelete(async () => {
      await prisma.client.video.deleteMany({ where: { id: video.id } });
    });
  }
}

describe('public reads', () => {
  it('a published video is visible by slug and in the list', async () => {
    await withFixtureVideo(async (video) => {
      await http().get(`${base}/videos/${video.slug}`).expect(200);

      const list = await http().get(`${base}/videos`).expect(200);
      expect((body(list).data as { slug: string }[]).map((v) => v.slug)).toContain(video.slug);
    });
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/videos/slugs`).expect(200);
  });

  it('filters by featured', async () => {
    await withFixtureVideo(
      async (video) => {
        const filtered = await http().get(`${base}/videos?featured=true`).expect(200);
        expect((body(filtered).data as { slug: string }[]).map((v) => v.slug)).toContain(video.slug);
      },
      { isFeatured: true },
    );
  });
});

describe('the embed URL', () => {
  it('composes a nocookie YouTube embed from the bare id, never from client input', async () => {
    await withFixtureVideo((video) => {
      // The renderer hands this straight to an iframe src, so it must be a
      // value the server built rather than one a client supplied.
      expect(video.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });
  });

  it('composes a Vimeo embed for a Vimeo video', async () => {
    await withFixtureVideo(
      (video) => {
        expect(video.embedUrl).toBe('https://player.vimeo.com/video/76979871');
      },
      { provider: 'VIMEO', providerVideoId: '76979871' },
    );
  });

  it('recomposes the embed when the video id changes', async () => {
    await withFixtureVideo(async (video) => {
      const updated = await http()
        .patch(`${base}/admin/videos/${video.id}`)
        .set('authorization', ownerToken)
        .send({ providerVideoId: 'abc123XYZ_-' })
        .expect(200);

      // A stale embed would silently keep playing the previous video.
      expect(body(updated).embedUrl).toBe('https://www.youtube-nocookie.com/embed/abc123XYZ_-');
    });
  });

  it('rejects a pasted URL instead of storing an unusable embed', async () => {
    await http()
      .post(`${base}/admin/videos`)
      .set('authorization', ownerToken)
      .send({
        title: `${PREFIX} Bad`,
        slug: `${PREFIX}-bad`,
        provider: 'YOUTUBE',
        providerVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      })
      .expect(400);
  });
});

describe('the provider invariant', () => {
  it('refuses a YouTube video with no provider video id', async () => {
    const rejected = await http()
      .post(`${base}/admin/videos`)
      .set('authorization', ownerToken)
      .send({ title: `${PREFIX} No Id`, slug: `${PREFIX}-no-id`, provider: 'YOUTUBE' })
      .expect(422);

    expect(body(rejected).code).toBe('VALIDATION_FAILED');
  });

  it('refuses a Cloudinary video with no hosted asset', async () => {
    await http()
      .post(`${base}/admin/videos`)
      .set('authorization', ownerToken)
      .send({
        title: `${PREFIX} No File`,
        slug: `${PREFIX}-no-file`,
        provider: 'CLOUDINARY',
      })
      .expect(422);
  });

  it('refuses a PATCH that would leave a stored video unplayable', async () => {
    // The create-time refinement cannot fire here: a partial PATCH does not
    // carry the fields it would need to compare. The service re-checks the
    // merged row, and this asserts that it does.
    await withFixtureVideo(async (video) => {
      await http()
        .patch(`${base}/admin/videos/${video.id}`)
        .set('authorization', ownerToken)
        .send({ provider: 'CLOUDINARY' })
        .expect(400);
    });
  });
});

describe('the publish workflow', () => {
  it('a DRAFT video is invisible publicly, visible to admin', async () => {
    await withFixtureVideo(
      async (video) => {
        await http().get(`${base}/videos/${video.slug}`).expect(404);

        await http()
          .get(`${base}/admin/videos/${video.id}`)
          .set('authorization', ownerToken)
          .expect(200);
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects re-publishing with 409', async () => {
    await withFixtureVideo(async (video) => {
      const conflict = await http()
        .patch(`${base}/admin/videos/${video.id}/publish`)
        .set('authorization', ownerToken)
        .expect(409);

      expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  it('soft-deletes and restores', async () => {
    await withFixtureVideo(async (video) => {
      await http()
        .delete(`${base}/admin/videos/${video.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/videos/${video.slug}`).expect(404);

      await http()
        .post(`${base}/admin/videos/${video.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      await http().get(`${base}/videos/${video.slug}`).expect(200);
    });
  });

  it('reuses a slug freed only by a soft delete without 500ing', async () => {
    // ADR 0020: a plain findUnique is narrowed to `deletedAt: null` by the
    // soft-delete extension, so it reports a slug held by a soft-deleted row
    // as free — and the unique index then rejects the insert.
    await withFixtureVideo(async (video) => {
      await http()
        .delete(`${base}/admin/videos/${video.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      const second = await http()
        .post(`${base}/admin/videos`)
        .set('authorization', ownerToken)
        .send({
          title: `${PREFIX} Temp Video`,
          provider: 'YOUTUBE',
          providerVideoId: 'dQw4w9WgXcQ',
        })
        .expect(201);

      const created = body(second) as unknown as AdminVideo;
      expect(created.slug).not.toBe(video.slug);

      await runWithHardDelete(async () => {
        await prisma.client.video.deleteMany({ where: { id: created.id } });
      });
    });
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/videos`).expect(401);
  });
});
