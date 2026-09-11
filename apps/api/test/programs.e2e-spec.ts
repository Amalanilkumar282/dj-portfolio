import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Programs — the publishable case with two direct foreign keys (`venueId`,
 * and `personaKey` resolved as everywhere else), no join-table relation of
 * its own. Structurally the closest module to Venues.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-programs';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.program.deleteMany({ where: { slug: { startsWith: PREFIX } } });
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

interface AdminProgram {
  id: string;
  slug: string;
  name: string;
  personaSlug: string | null;
  venueSlug: string | null;
}

async function withFixtureProgram(
  run: (program: AdminProgram) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/programs`)
    .set('authorization', ownerToken)
    .send({
      name: `${PREFIX} Temp Program`,
      slug: `${PREFIX}-temp`,
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const program = body(created) as unknown as AdminProgram;

  try {
    await run(program);
  } finally {
    await runWithHardDelete(async () => {
      await prisma.client.program.deleteMany({ where: { id: program.id } });
    });
  }
}

describe('public reads', () => {
  it('a published program is visible by slug and in the list', async () => {
    await withFixtureProgram(async (program) => {
      await http().get(`${base}/programs/${program.slug}`).expect(200);

      const list = await http().get(`${base}/programs`).expect(200);
      expect((body(list).data as { slug: string }[]).map((p) => p.slug)).toContain(program.slug);
    });
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/programs/slugs`).expect(200);
  });

  it('filters by venueSlug against a real seeded venue', async () => {
    const venue = await prisma.client.venue.findFirst({ select: { id: true, slug: true } });
    if (!venue) throw new Error('No venues seeded.');

    await withFixtureProgram(
      async (program) => {
        const filtered = await http().get(`${base}/programs?venueSlug=${venue.slug}`).expect(200);

        expect((body(filtered).data as { slug: string }[]).map((p) => p.slug)).toContain(
          program.slug,
        );
      },
      { venueId: venue.id },
    );
  });
});

describe('direct foreign keys', () => {
  it('resolves personaKey and accepts a direct venueId', async () => {
    const venue = await prisma.client.venue.findFirst({ select: { id: true, slug: true } });
    if (!venue) throw new Error('No venues seeded.');

    await withFixtureProgram(
      (program) => {
        expect(program.personaSlug).toBe('trinitrocosmic');
        expect(program.venueSlug).toBe(venue.slug);
      },
      { personaKey: 'TRINITROCOSMIC', venueId: venue.id },
    );
  });
});

describe('the publish workflow', () => {
  it('a DRAFT program is invisible publicly, visible to admin', async () => {
    await withFixtureProgram(
      async (program) => {
        await http().get(`${base}/programs/${program.slug}`).expect(404);

        await http()
          .get(`${base}/admin/programs/${program.id}`)
          .set('authorization', ownerToken)
          .expect(200);
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects re-publishing with 409', async () => {
    await withFixtureProgram(async (program) => {
      const conflict = await http()
        .patch(`${base}/admin/programs/${program.id}/publish`)
        .set('authorization', ownerToken)
        .expect(409);

      expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  it('soft-deletes and restores', async () => {
    await withFixtureProgram(async (program) => {
      await http()
        .delete(`${base}/admin/programs/${program.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/programs/${program.slug}`).expect(404);

      await http()
        .post(`${base}/admin/programs/${program.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      await http().get(`${base}/programs/${program.slug}`).expect(200);
    });
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/programs`).expect(401);
  });
});
