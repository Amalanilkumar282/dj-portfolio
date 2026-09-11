import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Releases — the same publishable shape as Personas/Venues, exercised
 * against a model with no seeded rows, so every read/write here is against a
 * fixture rather than harvested content.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-releases';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.release.deleteMany({ where: { slug: { startsWith: PREFIX } } });
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

interface AdminRelease {
  id: string;
  slug: string;
  title: string;
  personaSlug: string | null;
}

async function withFixtureRelease(
  run: (release: AdminRelease) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/releases`)
    .set('authorization', ownerToken)
    .send({
      title: `${PREFIX} Temp Release`,
      slug: `${PREFIX}-temp`,
      artistLabel: 'DJ Felicitous',
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const release = body(created) as unknown as AdminRelease;

  try {
    await run(release);
  } finally {
    await runWithHardDelete(async () => {
      await prisma.client.release.deleteMany({ where: { id: release.id } });
    });
  }
}

describe('public reads', () => {
  it('a published release is visible by slug and in the list', async () => {
    await withFixtureRelease(async (release) => {
      await http().get(`${base}/releases/${release.slug}`).expect(200);

      const list = await http().get(`${base}/releases`).expect(200);
      expect((body(list).data as { slug: string }[]).map((r) => r.slug)).toContain(release.slug);
    });
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/releases/slugs`).expect(200);
  });

  it('404s an unknown slug', async () => {
    const response = await http().get(`${base}/releases/not-a-real-release`).expect(404);
    expect(body(response).code).toBe('NOT_FOUND');
  });
});

describe('personaKey resolution', () => {
  it('resolves a valid personaKey', async () => {
    await withFixtureRelease(
      (release) => {
        expect(release.personaSlug).toBe('tnt');
      },
      { personaKey: 'TNT' },
    );
  });
});

describe('the publish workflow', () => {
  it('a DRAFT release is invisible publicly, visible to admin', async () => {
    await withFixtureRelease(
      async (release) => {
        await http().get(`${base}/releases/${release.slug}`).expect(404);

        const admin = await http()
          .get(`${base}/admin/releases/${release.id}`)
          .set('authorization', ownerToken)
          .expect(200);

        expect(body(admin).slug).toBe(release.slug);
      },
      { status: 'DRAFT' },
    );
  });

  it('publish / unpublish round-trips visibility', async () => {
    await withFixtureRelease(
      async (release) => {
        await http()
          .patch(`${base}/admin/releases/${release.id}/publish`)
          .set('authorization', ownerToken)
          .expect(200);
        await http().get(`${base}/releases/${release.slug}`).expect(200);

        await http()
          .patch(`${base}/admin/releases/${release.id}/unpublish`)
          .set('authorization', ownerToken)
          .expect(200);
        await http().get(`${base}/releases/${release.slug}`).expect(404);
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects re-publishing with 409', async () => {
    await withFixtureRelease(async (release) => {
      const conflict = await http()
        .patch(`${base}/admin/releases/${release.id}/publish`)
        .set('authorization', ownerToken)
        .expect(409);

      expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  it('soft-deletes and restores', async () => {
    await withFixtureRelease(async (release) => {
      await http()
        .delete(`${base}/admin/releases/${release.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/releases/${release.slug}`).expect(404);

      await http()
        .post(`${base}/admin/releases/${release.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      await http().get(`${base}/releases/${release.slug}`).expect(200);
    });
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/releases`).expect(401);
  });
});
