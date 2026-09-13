import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Events — the most complex module: direct FKs to `Venue` and `Program`,
 * `personaKey` resolved both on the event itself and per lineup slot (a
 * guest artist may have none), and `isPast`, which the service must **never**
 * write — the schema documents it as maintained by the hourly cron, and a
 * write here would fight that single writer.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-events';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.event.deleteMany({ where: { slug: { startsWith: PREFIX } } });
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

interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  isPast: boolean;
  personaSlug: string | null;
  venueSlug: string | null;
  lineup: { artistName: string; personaSlug: string | null; isHeadliner: boolean }[];
}

/** A future date, so `isPast` defaults false regardless of when this runs. */
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

async function withFixtureEvent(
  run: (event: AdminEvent) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/events`)
    .set('authorization', ownerToken)
    .send({
      title: `${PREFIX} Temp Event`,
      slug: `${PREFIX}-temp`,
      startsAt: FUTURE,
      venueNameOverride: 'A One-off Venue',
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const event = body(created) as unknown as AdminEvent;

  try {
    await run(event);
  } finally {
    await runWithHardDelete(async () => {
      await prisma.client.event.deleteMany({ where: { id: event.id } });
    });
  }
}

describe('creation requires a venue or a one-off name', () => {
  it('rejects an event with neither venueId nor venueNameOverride', async () => {
    const response = await http()
      .post(`${base}/admin/events`)
      .set('authorization', ownerToken)
      .send({ title: `${PREFIX} No Venue`, startsAt: FUTURE })
      .expect(422);

    expect(body(response).errors?.[0]?.pointer).toBe('/venueId');
  });

  it('rejects endsAt before startsAt', async () => {
    const response = await http()
      .post(`${base}/admin/events`)
      .set('authorization', ownerToken)
      .send({
        title: `${PREFIX} Backwards`,
        startsAt: FUTURE,
        endsAt: new Date(Date.parse(FUTURE) - 60_000).toISOString(),
        venueNameOverride: 'Somewhere',
      })
      .expect(422);

    expect(body(response).errors?.[0]?.pointer).toBe('/endsAt');
  });

  it('accepts a one-off venue name with no venueId', async () => {
    await withFixtureEvent((event) => {
      expect(event.venueSlug).toBeNull();
    });
  });
});

describe('public reads', () => {
  it('a published, future event appears under ?when=upcoming', async () => {
    await withFixtureEvent(async (event) => {
      const upcoming = await http().get(`${base}/events?when=upcoming`).expect(200);

      expect((body(upcoming).data as { slug: string }[]).map((e) => e.slug)).toContain(event.slug);
    });
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/events/slugs`).expect(200);
  });
});

describe('direct venue and program foreign keys', () => {
  it('resolves a real venueId to the venue relation', async () => {
    const venue = await prisma.client.venue.findFirst({ select: { id: true, slug: true } });
    if (!venue) throw new Error('No venues seeded.');

    await withFixtureEvent(
      (event) => {
        expect(event.venueSlug).toBe(venue.slug);
      },
      { venueId: venue.id, venueNameOverride: undefined },
    );
  });
});

describe('the lineup replaces wholesale', () => {
  it('resolves each slot personaKey independently; a guest artist may have none', async () => {
    await withFixtureEvent(
      (event) => {
        const byName = new Map(event.lineup.map((slot) => [slot.artistName, slot]));

        expect(byName.get('DJ Felicitous')?.personaSlug).toBe('felicitous');
        expect(byName.get('DJ Felicitous')?.isHeadliner).toBe(true);
        expect(byName.get('Guest Artist')?.personaSlug).toBeNull();
      },
      {
        lineup: [
          { artistName: 'DJ Felicitous', personaKey: 'FELICITOUS', isHeadliner: true },
          { artistName: 'Guest Artist', isHeadliner: false },
        ],
      },
    );
  });

  it('a second write with a shorter lineup actually removes the dropped slot', async () => {
    await withFixtureEvent(
      async (event) => {
        const updated = await http()
          .patch(`${base}/admin/events/${event.id}`)
          .set('authorization', ownerToken)
          .send({ lineup: [{ artistName: 'Solo Act', isHeadliner: true }] })
          .expect(200);

        const lineup = body(updated).lineup as { artistName: string }[];
        expect(lineup).toHaveLength(1);
        expect(lineup[0]?.artistName).toBe('Solo Act');
      },
      {
        lineup: [
          { artistName: 'Act One', isHeadliner: false },
          { artistName: 'Act Two', isHeadliner: true },
        ],
      },
    );
  });
});

describe('isPast is never writable', () => {
  it('ignores isPast if somehow present in the request body', async () => {
    // The contract has no `isPast` field at all, so this also proves the
    // strict-object validation strips/rejects it rather than the service
    // silently accepting and forwarding an unknown key to the database.
    const response = await http()
      .post(`${base}/admin/events`)
      .set('authorization', ownerToken)
      .send({
        title: `${PREFIX} Past Probe`,
        startsAt: FUTURE,
        venueNameOverride: 'Somewhere',
        isPast: true,
      })
      .expect(422);

    expect(body(response).errors?.[0]?.code).toBe('unrecognized_keys');
  });
});

describe('the publish workflow', () => {
  it('a DRAFT event is invisible publicly', async () => {
    await withFixtureEvent(
      async (event) => {
        await http().get(`${base}/events/${event.slug}`).expect(404);
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects re-publishing with 409', async () => {
    await withFixtureEvent(async (event) => {
      const conflict = await http()
        .patch(`${base}/admin/events/${event.id}/publish`)
        .set('authorization', ownerToken)
        .expect(409);

      expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  it('soft-deletes and restores', async () => {
    await withFixtureEvent(async (event) => {
      await http()
        .delete(`${base}/admin/events/${event.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/events/${event.slug}`).expect(404);

      await http()
        .post(`${base}/admin/events/${event.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      await http().get(`${base}/events/${event.slug}`).expect(200);
    });
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/events`).expect(401);
  });
});
