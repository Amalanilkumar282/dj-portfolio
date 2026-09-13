import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Playlists — the ordered join-table case. `trackIds` replaces
 * `PlaylistTrack` wholesale and **recomputes `totalDurationSec`** in the same
 * transaction, which is the behaviour this file exists to prove: a stale
 * denormalised total is a silent bug no status code would ever reveal.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-playlists';

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let ownerToken = '';

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.playlist.deleteMany({ where: { slug: { startsWith: PREFIX } } });
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

interface AdminPlaylist {
  id: string;
  slug: string;
  title: string;
  totalDurationSec: number | null;
  trackCount: number;
  tracks: { slug: string; durationSec: number | null }[];
}

async function withFixturePlaylist(
  run: (playlist: AdminPlaylist) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/playlists`)
    .set('authorization', ownerToken)
    .send({
      title: `${PREFIX} Temp Playlist`,
      slug: `${PREFIX}-temp`,
      status: 'PUBLISHED',
      ...overrides,
    })
    .expect(201);

  const playlist = body(created) as unknown as AdminPlaylist;

  try {
    await run(playlist);
  } finally {
    await runWithHardDelete(async () => {
      await prisma.client.playlist.deleteMany({ where: { id: playlist.id } });
    });
  }
}

/** Two seeded track ids with known durations, for the total-duration math. */
async function seededTracks(): Promise<{ id: string; slug: string; durationSec: number }[]> {
  const rows = await prisma.client.track.findMany({
    where: { durationSec: { not: null } },
    select: { id: true, slug: true, durationSec: true },
    take: 2,
  });

  return rows.map((r) => ({ id: r.id, slug: r.slug, durationSec: r.durationSec! }));
}

describe('public reads', () => {
  it('a published playlist is visible by slug and in the list', async () => {
    await withFixturePlaylist(async (playlist) => {
      await http().get(`${base}/playlists/${playlist.slug}`).expect(200);

      const list = await http().get(`${base}/playlists`).expect(200);
      expect((body(list).data as { slug: string }[]).map((p) => p.slug)).toContain(playlist.slug);
    });
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    await http().get(`${base}/playlists/slugs`).expect(200);
  });
});

describe('trackIds replace the ordered list and recompute totalDurationSec', () => {
  it('sets the track order and sums durations on create', async () => {
    const tracks = await seededTracks();
    if (tracks.length < 2) throw new Error('Need at least 2 seeded tracks with a duration.');

    await withFixturePlaylist(
      (playlist) => {
        expect(playlist.tracks.map((t) => t.slug)).toEqual(tracks.map((t) => t.slug));
        expect(playlist.totalDurationSec).toBe(tracks[0]!.durationSec + tracks[1]!.durationSec);
      },
      { trackIds: tracks.map((t) => t.id) },
    );
  });

  it('reordering the array changes the returned order', async () => {
    const tracks = await seededTracks();
    if (tracks.length < 2) throw new Error('Need at least 2 seeded tracks with a duration.');

    await withFixturePlaylist(
      async (playlist) => {
        const reversed = [...tracks].reverse().map((t) => t.id);

        const updated = await http()
          .patch(`${base}/admin/playlists/${playlist.id}`)
          .set('authorization', ownerToken)
          .send({ trackIds: reversed })
          .expect(200);

        expect((body(updated).tracks as { slug: string }[]).map((t) => t.slug)).toEqual(
          [...tracks].reverse().map((t) => t.slug),
        );
      },
      { trackIds: tracks.map((t) => t.id) },
    );
  });

  it('removing a track from the array recomputes the total downward', async () => {
    const tracks = await seededTracks();
    if (tracks.length < 2) throw new Error('Need at least 2 seeded tracks with a duration.');

    await withFixturePlaylist(
      async (playlist) => {
        const updated = await http()
          .patch(`${base}/admin/playlists/${playlist.id}`)
          .set('authorization', ownerToken)
          .send({ trackIds: [tracks[0]!.id] })
          .expect(200);

        expect(body(updated).totalDurationSec).toBe(tracks[0]!.durationSec);
        expect((body(updated).tracks as unknown[]).length).toBe(1);
      },
      { trackIds: tracks.map((t) => t.id) },
    );
  });

  it('silently drops a track id that does not resolve, rather than failing the write', async () => {
    const tracks = await seededTracks();
    if (tracks.length === 0) throw new Error('Need at least 1 seeded track.');

    // Syntactically a valid id (so it passes the `Id` shape check) but not one
    // that exists — a track deleted between the admin form loading and the
    // save landing, which is the actual case this guards against. A
    // hyphenated string would be rejected by Zod before reaching the
    // repository at all, which is a different guarantee than this one.
    const wellFormedButMissing = 'a'.repeat(24);

    await withFixturePlaylist(
      (playlist) => {
        expect(playlist.tracks.map((t) => t.slug)).toEqual([tracks[0]!.slug]);
      },
      { trackIds: [tracks[0]!.id, wellFormedButMissing] },
    );
  });
});

describe('the publish workflow', () => {
  it('a DRAFT playlist is invisible publicly', async () => {
    await withFixturePlaylist(
      async (playlist) => {
        await http().get(`${base}/playlists/${playlist.slug}`).expect(404);
      },
      { status: 'DRAFT' },
    );
  });

  it('soft-deletes and restores', async () => {
    await withFixturePlaylist(async (playlist) => {
      await http()
        .delete(`${base}/admin/playlists/${playlist.id}`)
        .set('authorization', ownerToken)
        .expect(204);

      await http().get(`${base}/playlists/${playlist.slug}`).expect(404);

      await http()
        .post(`${base}/admin/playlists/${playlist.id}/restore`)
        .set('authorization', ownerToken)
        .expect(200);

      await http().get(`${base}/playlists/${playlist.slug}`).expect(200);
    });
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/playlists`).expect(401);
  });
});
