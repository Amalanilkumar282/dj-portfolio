import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Venues — the second **publishable** exemplar after Personas, and the case
 * that exercises a compound uniqueness constraint.
 *
 * `Venue` has `@@unique([name, city])` in addition to the usual unique
 * `slug`, so two venues can collide without either one's slug ever
 * conflicting — "Test Venue" in Bengaluru and a second "Test Venue" in
 * Bengaluru collide; "Test Venue" in Chennai does not. That collision is
 * checked proactively (`assertNameCityFree`) so the 409 names `/name`
 * rather than surfacing Postgres's P2002 against a composite key the caller
 * has no vocabulary for.
 *
 * Venue was also the model that exposed a real schema gap: it had `status`
 * and `publishedAt` but no `scheduledAt`, and no `published_has_date` CHECK
 * constraint at all — see ADR 0019. The last two tests in this file assert
 * that gap stays closed.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-venues';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

interface AdminVenue {
  id: string;
  slug: string;
  name: string;
  city: string;
  sortIndex: number;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

async function removeFixtureVenues(): Promise<void> {
  // `runWithHardDelete` is required, not tidiness: a plain `deleteMany` is
  // rewritten by the soft-delete extension into an `UPDATE deletedAt`, so the
  // row survives and keeps occupying its unique `slug` / `(name, city)` pair.
  // The next fixture creation with the same values then 409s at the real
  // database constraint — which is exactly the bug `anyDeletionState()`
  // exists to prevent on the read side, but cleanup still needs a genuine
  // delete on the write side so the constraint is actually freed.
  const { runWithHardDelete } = await import('@dj/db');
  await runWithHardDelete(async () => {
    await prisma.client.venue.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  });
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);

  await removeFixtureVenues();

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
  await removeFixtureVenues();
  await app.close();
});

async function adminVenues(query = ''): Promise<AdminVenue[]> {
  const response = await http()
    .get(`${base}/admin/venues?perPage=100${query}`)
    .set('authorization', ownerToken)
    .expect(200);

  return body(response).data as AdminVenue[];
}

/** Creates a throwaway published venue and guarantees it is removed. */
async function withFixtureVenue(
  run: (venue: AdminVenue) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/venues`)
    .set('authorization', ownerToken)
    .send({
      name: `${PREFIX} Temp Venue`,
      slug: `${PREFIX}-temp`,
      city: 'Bengaluru',
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const venue = body(created) as unknown as AdminVenue;

  try {
    await run(venue);
  } finally {
    // A genuine delete, not the soft-delete path. Without `runWithHardDelete`
    // the row survives with `deletedAt` set and keeps occupying its unique
    // `slug` / `(name, city)` pair, so the *next* fixture creation with the
    // same defaults 409s at the real database constraint — this was the
    // actual cause of a cascade of unrelated-looking failures the first time
    // this spec ran. See `anyDeletionState()` in @dj/db.
    const { runWithHardDelete } = await import('@dj/db');
    await runWithHardDelete(async () => {
      await prisma.client.venue.deleteMany({ where: { id: venue.id } });
    });
  }
}

describe('public reads', () => {
  it('lists published venues', async () => {
    const response = await http().get(`${base}/venues`).expect(200);

    expect(body(response).meta?.pagination).toMatchObject({ mode: 'cursor' });
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    const response = await http().get(`${base}/venues/slugs`).expect(200);

    const data = body(response).data as { slug: string; updatedAt: string }[];
    expect(Array.isArray(data)).toBe(true);
  });

  it('404s an unknown slug', async () => {
    const response = await http().get(`${base}/venues/not-a-real-venue`).expect(404);

    expect(body(response).code).toBe('NOT_FOUND');
  });

  it('rejects an include outside the allowlist', async () => {
    const response = await http().get(`${base}/venues?include=secretTable`).expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');
  });

  it('rejects a sort outside the allowlist', async () => {
    const response = await http().get(`${base}/venues?sort=capacity`).expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');
  });
});

describe('the publish workflow', () => {
  it('a DRAFT venue is invisible publicly and visible to the admin', async () => {
    await withFixtureVenue(
      async (venue) => {
        await http().get(`${base}/venues/${venue.slug}`).expect(404);

        const admin = await http()
          .get(`${base}/admin/venues/${venue.id}`)
          .set('authorization', ownerToken)
          .expect(200);

        expect(body(admin).slug).toBe(venue.slug);
      },
      { status: 'DRAFT' },
    );
  });

  it('publishing makes it visible; unpublishing hides it again', async () => {
    await withFixtureVenue(
      async (venue) => {
        // Created DRAFT this time, then published through the workflow route
        // rather than at creation — exercising the transition itself.
        await http()
          .patch(`${base}/admin/venues/${venue.id}/publish`)
          .set('authorization', ownerToken)
          .expect(200);

        await http().get(`${base}/venues/${venue.slug}`).expect(200);

        await http()
          .patch(`${base}/admin/venues/${venue.id}/unpublish`)
          .set('authorization', ownerToken)
          .expect(200);

        await http().get(`${base}/venues/${venue.slug}`).expect(404);
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects re-publishing an already-published venue with 409', async () => {
    await withFixtureVenue(async (venue) => {
      const conflict = await http()
        .patch(`${base}/admin/venues/${venue.id}/publish`)
        .set('authorization', ownerToken)
        .expect(409);

      expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  it('soft-deletes and restores', async () => {
    await withFixtureVenue(async (venue) => {
      await http()
        .delete(`${base}/admin/venues/${venue.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/venues/${venue.slug}`).expect(404);

      const restored = await http()
        .post(`${base}/admin/venues/${venue.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      expect(body(restored).slug).toBe(venue.slug);
      await http().get(`${base}/venues/${venue.slug}`).expect(200);
    });
  });
});

describe('the compound uniqueness constraint', () => {
  it('rejects a duplicate name in the same city, against /name', async () => {
    await withFixtureVenue(async (venue) => {
      const response = await http()
        .post(`${base}/admin/venues`)
        .set('authorization', ownerToken)
        .send({
          name: venue.name,
          slug: `${PREFIX}-collision`,
          city: venue.city,
          status: 'PUBLISHED',
        })
        .expect(409);

      expect(body(response).code).toBe('UNIQUE_CONSTRAINT');
      expect(body(response).errors?.[0]?.pointer).toBe('/name');
    });
  });

  it('allows the same name in a different city', async () => {
    await withFixtureVenue(async (venue) => {
      const created = await http()
        .post(`${base}/admin/venues`)
        .set('authorization', ownerToken)
        .send({
          name: venue.name,
          slug: `${PREFIX}-other-city`,
          city: 'Chennai',
          status: 'PUBLISHED',
        })
        .expect(201);

      const { runWithHardDelete } = await import('@dj/db');
      await runWithHardDelete(async () => {
        await prisma.client.venue.deleteMany({
          where: { id: (body(created) as { id: string }).id },
        });
      });
    });
  });

  it('rejects a duplicate slug regardless of name or city', async () => {
    await withFixtureVenue(async (venue) => {
      await http()
        .post(`${base}/admin/venues`)
        .set('authorization', ownerToken)
        .send({
          name: `${PREFIX} A Different Name`,
          slug: venue.slug,
          city: 'Chennai',
          status: 'PUBLISHED',
        })
        .expect(409);
    });
  });
});

describe('admin routing and permissions', () => {
  it('routes /reorder to reorder, not to :id', async () => {
    const original = await adminVenues();
    const restore = original.slice(0, 5).map((v) => ({ id: v.id, sortIndex: v.sortIndex }));

    if (restore.length < 2) return; // needs seeded venues to be meaningful

    const reorder = (entries: { id: string; sortIndex: number }[]) =>
      http()
        .patch(`${base}/admin/venues/reorder`)
        .set('authorization', ownerToken)
        .send({ entries });

    try {
      await reorder(
        [...restore].reverse().map((v, index) => ({ id: v.id, sortIndex: index })),
      ).expect(204);
    } finally {
      await reorder(restore).expect(204);
    }
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/venues`).expect(401);
  });
});

describe('the scheduledAt gap that ADR 0019 closed', () => {
  it('accepts a scheduled publish, proving the column exists', async () => {
    // Before ADR 0019, Venue had no `scheduledAt` column at all, so
    // `BaseContentService.schedule()` would have failed at the database with
    // an unknown-column error rather than a clean validation failure.
    await withFixtureVenue(
      async (venue) => {
        const publishAt = new Date(Date.now() + 60_000).toISOString();

        const scheduled = await http()
          .patch(`${base}/admin/venues/${venue.id}/schedule`)
          .set('authorization', ownerToken)
          .send({ publishAt })
          .expect(200);

        expect(body(scheduled).scheduledAt).not.toBeNull();
        expect(body(scheduled).status).toBe('DRAFT');
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects a PUBLISHED venue with no publishedAt at the database layer', async () => {
    // Direct Prisma call, bypassing the service's own stamping, to prove the
    // CHECK constraint itself is what refuses this — not merely the service
    // code path. `venues_published_has_date` did not exist before ADR 0019.
    await expect(
      prisma.client.venue.create({
        data: {
          slug: `${PREFIX}-no-published-at`,
          name: `${PREFIX} No PublishedAt`,
          city: 'Bengaluru',
          status: 'PUBLISHED',
          publishedAt: null,
        },
      }),
    ).rejects.toThrow();
  });
});
