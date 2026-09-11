import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { RbacService } from '../src/modules/rbac/rbac.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Genres — the taxonomy case.
 *
 * Genres are the one content module with **no publish workflow**: no `status`,
 * no `publishedAt`, no `deletedAt`. So the properties under test here are the
 * ones that differ from a publishable resource:
 *
 * - the publish routes do not exist at all
 * - `DELETE` is a **real** delete, and is refused while anything uses it
 * - `name` is unique as well as `slug`, so both collisions are reported
 *   against the right field
 *
 * The delete guard is the important one. `PersonaGenre` and `TrackGenre` both
 * declare `onDelete: Cascade`, so an unguarded delete succeeds and silently
 * strips the tag from every persona and track that carried it.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-genres';

let app: INestApplication;
let prisma: PrismaService;

/** This spec's HTTP client. Each call gets a fresh address — see harness.ts. */
const http = () => client(app);

const tokens = new Map<string, string>();

function as(role: string): string {
  const token = tokens.get(role);
  if (!token) throw new Error(`No token minted for ${role}`);
  return `Bearer ${token}`;
}

/** Removes any genre this spec created, including from a crashed run. */
async function removeFixtureGenres(): Promise<void> {
  // A genuine delete: these are fixtures, and Genre has no `deletedAt` anyway.
  await prisma.client.genre.deleteMany({ where: { slug: { startsWith: PREFIX } } });
}

async function mintViewer(): Promise<string> {
  const passwords = app.get(PasswordService);
  const rbac = app.get(RbacService);

  const role = await rbac.findRoleByKey('VIEWER');
  if (!role) throw new Error('VIEWER is not seeded. Run pnpm db:seed.');

  const user = await prisma.client.user.create({
    data: {
      email: `${PREFIX}-viewer@example.test`,
      name: 'E2E Genre Viewer',
      passwordHash: await passwords.hash('e2e-Password!2026'),
      isActive: true,
    },
  });
  await rbac.assignRole(user.id, role.id);

  const login = await http()
    .post(`${base}/auth/login`)
    .send({ email: user.email, password: 'e2e-Password!2026' })
    .expect(200);

  return String(body(login).accessToken);
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);

  await removeFixtureGenres();
  const { runWithHardDelete } = await import('@dj/db');
  await runWithHardDelete(async () => {
    await prisma.client.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({
      email: requiredEnv('ADMIN_SEED_EMAIL'),
      password: requiredEnv('ADMIN_SEED_PASSWORD'),
    })
    .expect(200);

  tokens.set('SUPER_ADMIN', String(body(owner).accessToken));
  tokens.set('VIEWER', await mintViewer());
});

afterAll(async () => {
  await removeFixtureGenres();
  const { runWithHardDelete } = await import('@dj/db');
  await runWithHardDelete(async () => {
    await prisma.client.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });
  await app.close();
});

interface AdminGenre {
  id: string;
  slug: string;
  name: string;
  sortIndex: number;
  personaCount: number;
  trackCount: number;
}

async function adminGenres(query = ''): Promise<AdminGenre[]> {
  const response = await http()
    .get(`${base}/admin/genres?perPage=100${query}`)
    .set('authorization', as('SUPER_ADMIN'))
    .expect(200);

  return body(response).data as AdminGenre[];
}

/** Creates a throwaway genre and guarantees it is removed. */
async function withFixtureGenre(
  // `void` as well as `Promise<void>`: a callback that only asserts on the
  // created row has nothing to await, and forcing it to be async would be a
  // lie the linter rightly objects to.
  run: (genre: AdminGenre) => Promise<void> | void,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const created = await http()
    .post(`${base}/admin/genres`)
    .set('authorization', as('SUPER_ADMIN'))
    .send({ name: `${PREFIX} Temp Genre`, slug: `${PREFIX}-temp`, ...overrides })
    .expect(201);

  const genre = body(created) as unknown as AdminGenre;

  try {
    await run(genre);
  } finally {
    // Directly, not through the API: the test may have already deleted it, and
    // deleteMany on a missing row is a no-op where DELETE /:id would 404.
    await prisma.client.genre.deleteMany({ where: { id: genre.id } });
  }
}

describe('public reads', () => {
  it('lists the seeded genres', async () => {
    const response = await http().get(`${base}/genres`).expect(200);

    const data = body(response).data as { slug: string; name: string }[];
    expect(data.length).toBeGreaterThan(0);
    expect(body(response).meta?.pagination).toMatchObject({ mode: 'cursor' });
  });

  it('defaults to a limit that returns the whole taxonomy', async () => {
    // A genre list is a filter control: a paginated one is useless to the
    // caller, who needs every option at once to render it.
    const response = await http().get(`${base}/genres`).expect(200);
    const pagination = body(response).meta?.pagination as { limit: number; hasMore: boolean };

    expect(pagination.limit).toBe(100);
    expect(pagination.hasMore).toBe(false);
  });

  it('routes /slugs to slugs, not to :slug', async () => {
    // Regression guard: a literal route declared below `:slug` is swallowed by
    // it, and would 404 as if a genre called "slugs" were missing.
    const response = await http().get(`${base}/genres/slugs`).expect(200);

    const data = body(response).data as { slug: string; updatedAt: string }[];
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('updatedAt');
  });

  it('reads one genre by slug', async () => {
    const [first] = await adminGenres();
    if (!first) throw new Error('No genres seeded.');

    const response = await http().get(`${base}/genres/${first.slug}`).expect(200);

    expect(body(response).slug).toBe(first.slug);
    expect(body(response).name).toBe(first.name);
  });

  it('404s an unknown slug', async () => {
    const response = await http().get(`${base}/genres/not-a-real-genre`).expect(404);

    expect(body(response).code).toBe('NOT_FOUND');
  });

  it('filters to genres attached to published content', async () => {
    // `inUse` reaches through the join into the owning content's publish
    // state, so a genre tagged only on drafts must not appear.
    const all = await http().get(`${base}/genres`).expect(200);
    const used = await http().get(`${base}/genres?inUse=true`).expect(200);

    const allSlugs = (body(all).data as { slug: string }[]).map((g) => g.slug);
    const usedSlugs = (body(used).data as { slug: string }[]).map((g) => g.slug);

    expect(usedSlugs.length).toBeGreaterThan(0);
    expect(usedSlugs.length).toBeLessThanOrEqual(allSlugs.length);
    expect(allSlugs).toEqual(expect.arrayContaining(usedSlugs));
  });

  it('rejects a sort outside the allowlist', async () => {
    const response = await http().get(`${base}/genres?sort=colorHex`).expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');
  });

  it('walks the list by cursor without repeating or skipping', async () => {
    const all = await http().get(`${base}/genres?limit=100`).expect(200);
    const expected = (body(all).data as { slug: string }[]).map((g) => g.slug);

    /** One page, with both fields the walk needs, explicitly typed. */
    const fetchPage = async (
      cursor: string | null,
    ): Promise<{ slugs: string[]; nextCursor: string | null }> => {
      const suffix = cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
      const response = await http().get(`${base}/genres?limit=1${suffix}`).expect(200);

      return {
        slugs: (body(response).data as { slug: string }[]).map((g) => g.slug),
        nextCursor: (body(response).meta?.pagination as { nextCursor: string | null }).nextCursor,
      };
    };

    const seen: string[] = [];
    let cursor: string | null = null;

    for (let guard = 0; guard <= expected.length; guard += 1) {
      const page = await fetchPage(cursor);
      seen.push(...page.slugs);

      cursor = page.nextCursor;
      if (cursor === null) break;
    }

    expect(seen).toEqual(expected);
  });
});

describe('there is no publish workflow', () => {
  it('exposes no publish, unpublish, archive or schedule route', async () => {
    // A genre has no `status` column, so these must not exist. If
    // BaseContentService were ever inherited here they would appear and fail
    // at the database instead — a 500 rather than a 404.
    const [first] = await adminGenres();
    if (!first) throw new Error('No genres seeded.');

    for (const action of ['publish', 'unpublish', 'archive', 'schedule']) {
      await http()
        .patch(`${base}/admin/genres/${first.id}/${action}`)
        .set('authorization', as('SUPER_ADMIN'))
        .expect(404);
    }
  });
});

describe('admin reads', () => {
  it('reports usage counts, which the delete guard depends on', async () => {
    const genres = await adminGenres();

    expect(genres.length).toBeGreaterThan(0);
    for (const genre of genres) {
      expect(genre.personaCount).toBeTypeOf('number');
      expect(genre.trackCount).toBeTypeOf('number');
    }
    // At least one seeded genre is actually tagged, or the guard test below
    // would be asserting nothing.
    expect(genres.some((g) => g.personaCount + g.trackCount > 0)).toBe(true);
  });

  it('reports offset pagination metadata', async () => {
    const response = await http()
      .get(`${base}/admin/genres?page=1&perPage=5`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(200);

    const pagination = body(response).meta?.pagination as Record<string, unknown>;
    expect(pagination.mode).toBe('offset');
    expect(pagination.totalCount).toBeTypeOf('number');
    expect((body(response).data as unknown[]).length).toBeLessThanOrEqual(5);
  });
});

describe('admin writes', () => {
  it('creates a genre and derives a slug from the name', async () => {
    await withFixtureGenre(
      (genre) => {
        expect(genre.slug).toBe(`${PREFIX}-derived`);
        expect(genre.personaCount).toBe(0);
      },
      { name: `${PREFIX} Derived`, slug: `${PREFIX}-derived` },
    );
  });

  it('updates only the fields mentioned', async () => {
    await withFixtureGenre(async (genre) => {
      const updated = await http()
        .patch(`${base}/admin/genres/${genre.id}`)
        .set('authorization', as('SUPER_ADMIN'))
        .send({ description: 'a description and nothing else' })
        .expect(200);

      expect(body(updated).description).toBe('a description and nothing else');
      // Untouched, because PATCH data is built additively.
      expect(body(updated).name).toBe(genre.name);
      expect(body(updated).slug).toBe(genre.slug);
    });
  });

  it('rejects a duplicate name against /name, not /slug', async () => {
    const [existing] = await adminGenres();
    if (!existing) throw new Error('No genres seeded.');

    const response = await http()
      .post(`${base}/admin/genres`)
      .set('authorization', as('SUPER_ADMIN'))
      .send({ name: existing.name, slug: `${PREFIX}-distinct-slug` })
      .expect(409);

    // `name` is @unique as well as `slug`. Left to Prisma this arrives as a
    // P2002 naming a column the caller never edited.
    expect(body(response).code).toBe('UNIQUE_CONSTRAINT');
    expect(body(response).errors?.[0]?.pointer).toBe('/name');
  });

  it('rejects an unknown property rather than stripping it', async () => {
    const response = await http()
      .post(`${base}/admin/genres`)
      .set('authorization', as('SUPER_ADMIN'))
      .send({ name: `${PREFIX} Strict`, isAdmin: true })
      .expect(422);

    expect(body(response).errors?.[0]?.code).toBe('unrecognized_keys');
  });

  it('validates colorHex as a hex colour', async () => {
    const response = await http()
      .post(`${base}/admin/genres`)
      .set('authorization', as('SUPER_ADMIN'))
      .send({ name: `${PREFIX} Bad Colour`, colorHex: 'rebeccapurple' })
      .expect(422);

    expect(body(response).errors?.[0]?.pointer).toBe('/colorHex');
  });
});

describe('the delete guard', () => {
  it('refuses to delete a genre that content still uses', async () => {
    // The whole point: both join tables cascade, so an unguarded delete would
    // succeed and silently strip the tag from every persona and track.
    const inUse = (await adminGenres()).find((g) => g.personaCount + g.trackCount > 0);
    if (!inUse) throw new Error('No seeded genre is in use; the guard cannot be tested.');

    const response = await http()
      .delete(`${base}/admin/genres/${inUse.id}`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(409);

    expect(body(response).code).toBe('GENRE_IN_USE');
    // It must say what is in the way, or the admin cannot act on the refusal.
    expect((body(response).errors ?? []).length).toBeGreaterThan(0);
  });

  it('leaves the referencing content untouched after a refusal', async () => {
    const inUse = (await adminGenres()).find((g) => g.personaCount + g.trackCount > 0);
    if (!inUse) throw new Error('No seeded genre is in use.');

    const before = { personas: inUse.personaCount, tracks: inUse.trackCount };

    await http()
      .delete(`${base}/admin/genres/${inUse.id}`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(409);

    const after = (await adminGenres()).find((g) => g.id === inUse.id);
    expect(after).toBeDefined();
    expect({ personas: after?.personaCount, tracks: after?.trackCount }).toEqual(before);
  });

  it('deletes a genre nothing references', async () => {
    await withFixtureGenre(async (genre) => {
      await http()
        .delete(`${base}/admin/genres/${genre.id}`)
        .set('authorization', as('SUPER_ADMIN'))
        .expect(204);

      // Really gone — Genre has no `deletedAt`, so this is a hard delete.
      await http().get(`${base}/genres/${genre.slug}`).expect(404);
      expect(await prisma.client.genre.findUnique({ where: { id: genre.id } })).toBeNull();
    });
  });
});

describe('admin routing and permissions', () => {
  it('routes /reorder to reorder, not to :id', async () => {
    const original = await adminGenres();
    const restore = original.map((g) => ({ id: g.id, sortIndex: g.sortIndex }));

    const reorder = (entries: { id: string; sortIndex: number }[]) =>
      http()
        .patch(`${base}/admin/genres/reorder`)
        .set('authorization', as('SUPER_ADMIN'))
        .send({ entries });

    try {
      await reorder(
        [...original].reverse().map((g, index) => ({ id: g.id, sortIndex: index })),
      ).expect(204);

      expect((await adminGenres()).map((g) => g.slug)).toEqual(
        [...original].reverse().map((g) => g.slug),
      );
    } finally {
      // Restored, or a @dj/db integration test asserting the seeded order
      // fails in a different package with nothing pointing back here.
      await reorder(restore).expect(204);
    }

    expect((await adminGenres()).map((g) => g.slug)).toEqual(original.map((g) => g.slug));
  });

  it('refuses a VIEWER every write', async () => {
    const [first] = await adminGenres();
    if (!first) throw new Error('No genres seeded.');

    // Each request is built and sent inside the loop. Building them up front
    // and awaiting later gave ECONNREFUSED: a supertest request binds a port
    // when it is created, not when it is awaited.
    const attempts: (() => Promise<unknown>)[] = [
      async () => {
        const r = await http()
          .post(`${base}/admin/genres`)
          .set('authorization', as('VIEWER'))
          .send({ name: `${PREFIX} Nope` })
          .expect(403);
        expect(body(r).code).toBe('INSUFFICIENT_PERMISSIONS');
      },
      async () => {
        const r = await http()
          .patch(`${base}/admin/genres/${first.id}`)
          .set('authorization', as('VIEWER'))
          .send({ description: 'nope' })
          .expect(403);
        expect(body(r).code).toBe('INSUFFICIENT_PERMISSIONS');
      },
      async () => {
        const r = await http()
          .delete(`${base}/admin/genres/${first.id}`)
          .set('authorization', as('VIEWER'))
          .expect(403);
        expect(body(r).code).toBe('INSUFFICIENT_PERMISSIONS');
      },
    ];

    for (const attempt of attempts) await attempt();
  });

  it('lets a VIEWER read', async () => {
    await http().get(`${base}/admin/genres`).set('authorization', as('VIEWER')).expect(200);
  });

  it('requires authentication', async () => {
    await http().get(`${base}/admin/genres`).expect(401);
  });
});
