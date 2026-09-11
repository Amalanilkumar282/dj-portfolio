import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Tracks — the module with a many-to-many (`genreSlugs`) and a
 * replace-on-write one-to-many (`streamLinks`) alongside the usual
 * publishable workflow. `personaKey` resolution (contract vocabulary) to
 * `personaId` (the FK) is exercised here for the first time in Phase 4.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-tracks';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.track.deleteMany({ where: { slug: { startsWith: PREFIX } } });
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

interface AdminTrack {
  id: string;
  slug: string;
  title: string;
  genres: { slug: string; name: string }[];
  streamLinks: { platform: string; url: string }[];
  personaSlug: string | null;
}

async function withFixtureTrack(
  run: (track: AdminTrack) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/tracks`)
    .set('authorization', ownerToken)
    .send({
      title: `${PREFIX} Temp Track`,
      slug: `${PREFIX}-temp`,
      artistLabel: 'DJ Felicitous',
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const track = body(created) as unknown as AdminTrack;

  try {
    await run(track);
  } finally {
    await runWithHardDelete(async () => {
      await prisma.client.track.deleteMany({ where: { id: track.id } });
    });
  }
}

describe('public reads', () => {
  it('lists published tracks and reads one by slug', async () => {
    const list = await http().get(`${base}/tracks`).expect(200);
    const first = (body(list).data as { slug: string }[])[0];
    if (!first) throw new Error('No tracks seeded.');

    const detail = await http().get(`${base}/tracks/${first.slug}`).expect(200);
    expect(body(detail).slug).toBe(first.slug);
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/tracks/slugs`).expect(200);
  });

  it('filters by personaSlug', async () => {
    const response = await http().get(`${base}/tracks?personaSlug=felicitous`).expect(200);

    for (const track of body(response).data as { personaSlug: string | null }[]) {
      expect(track.personaSlug).toBe('felicitous');
    }
  });
});

describe('genres and stream links replace wholesale', () => {
  it('attaches genres by slug and reports them back', async () => {
    const genres = await http().get(`${base}/genres?limit=2`).expect(200);
    const slugs = (body(genres).data as { slug: string }[]).map((g) => g.slug);
    if (slugs.length === 0) throw new Error('No genres seeded.');

    await withFixtureTrack(
      (track) => {
        expect(track.genres.map((g) => g.slug).sort()).toEqual([...slugs].sort());
      },
      { genreSlugs: slugs },
    );
  });

  it('removing a genre from the array actually detaches it', async () => {
    const genres = await http().get(`${base}/genres?limit=2`).expect(200);
    const slugs = (body(genres).data as { slug: string }[]).map((g) => g.slug);
    if (slugs.length < 2) throw new Error('Need at least 2 seeded genres.');

    await withFixtureTrack(
      async (track) => {
        const updated = await http()
          .patch(`${base}/admin/tracks/${track.id}`)
          .set('authorization', ownerToken)
          .send({ genreSlugs: [slugs[0]] })
          .expect(200);

        const remaining = (body(updated).genres as { slug: string }[]).map((g) => g.slug);
        expect(remaining).toEqual([slugs[0]]);
      },
      { genreSlugs: slugs },
    );
  });

  it('replaces stream links wholesale and preserves order', async () => {
    await withFixtureTrack(
      (track) => {
        expect(track.streamLinks.map((l) => l.platform)).toEqual(['SOUNDCLOUD', 'SPOTIFY']);
      },
      {
        streamLinks: [
          { platform: 'SOUNDCLOUD', url: 'https://soundcloud.com/example/track' },
          { platform: 'SPOTIFY', url: 'https://open.spotify.com/track/example' },
        ],
      },
    );
  });
});

describe('personaKey resolution', () => {
  it('resolves a valid personaKey to the persona relation', async () => {
    await withFixtureTrack(
      (track) => {
        expect(track.personaSlug).toBe('felicitous');
      },
      { personaKey: 'FELICITOUS' },
    );
  });

  it('rejects an unrecognised personaKey at validation, not at the database', async () => {
    const response = await http()
      .post(`${base}/admin/tracks`)
      .set('authorization', ownerToken)
      .send({
        title: `${PREFIX} Bad Persona`,
        artistLabel: 'DJ Felicitous',
        personaKey: 'NOT_A_REAL_PERSONA',
      })
      .expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');
  });
});

describe('the publish workflow and permissions', () => {
  it('a DRAFT track is invisible publicly', async () => {
    await withFixtureTrack(
      async (track) => {
        await http().get(`${base}/tracks/${track.slug}`).expect(404);
      },
      { status: 'DRAFT' },
    );
  });

  it('rejects re-publishing with 409', async () => {
    await withFixtureTrack(async (track) => {
      const conflict = await http()
        .patch(`${base}/admin/tracks/${track.id}/publish`)
        .set('authorization', ownerToken)
        .expect(409);

      expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  it('soft-deletes and restores', async () => {
    await withFixtureTrack(async (track) => {
      await http()
        .delete(`${base}/admin/tracks/${track.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/tracks/${track.slug}`).expect(404);

      await http()
        .post(`${base}/admin/tracks/${track.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      await http().get(`${base}/tracks/${track.slug}`).expect(200);
    });
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/tracks`).expect(401);
  });
});
