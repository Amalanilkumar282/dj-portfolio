import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaClient, type ExtendedPrismaClient } from '../client.js';
import { runWithDbContext, runWithHardDelete } from '../context.js';
import { anyDeletionState } from '../extensions/publish.js';

/**
 * Integration tests for the soft-delete extension.
 *
 * These are the Phase 1 exit criteria: the guarantee is that no repository
 * can hard-delete content by accident, and that a soft-deleted row is
 * unreachable through every read path — including `findUnique` by id and by
 * slug, which is how "deleted" content leaks back onto a live page.
 *
 * Requires a live Postgres with migrations applied (see the test README).
 */

let prisma: ExtendedPrismaClient;

/** Unique per run, so a failed run does not poison the next. */
const suffix = `sd-${Date.now().toString(36)}`;

beforeAll(() => {
  prisma = createPrismaClient();
});

afterAll(async () => {
  // Clean up with genuine deletes so the test database does not accumulate.
  await runWithHardDelete(async () => {
    await prisma.venue.deleteMany({ where: { slug: { contains: suffix } } });
  });
  await prisma.$disconnect();
});

async function makeVenue(name: string) {
  return prisma.venue.create({
    data: {
      slug: `${name}-${suffix}`,
      name: `${name} ${suffix}`,
      city: 'Bengaluru',
      country: 'India',
      // Explicit DRAFT: Venue defaults to PUBLISHED, and these fixtures are
      // about soft-delete and audit mechanics, not the publish workflow.
      // `venues_published_has_date` now enforces that a PUBLISHED row must
      // carry a publishedAt (see ADR 0019) — a bare default here would fail.
      status: 'DRAFT',
    },
  });
}

describe('soft delete', () => {
  it('rewrites delete into an update that stamps deletedAt', async () => {
    const venue = await makeVenue('rewrite');

    await prisma.venue.delete({ where: { id: venue.id } });

    // The row must still be physically present. Reading it back requires an
    // explicit deletedAt filter, which is exactly the admin trash path.
    const row = await prisma.venue.findFirst({
      where: { id: venue.id, deletedAt: { not: null } },
    });

    expect(row).not.toBeNull();
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('hides soft-deleted rows from findMany', async () => {
    const kept = await makeVenue('kept');
    const removed = await makeVenue('removed');
    await prisma.venue.delete({ where: { id: removed.id } });

    const rows = await prisma.venue.findMany({
      where: { slug: { contains: suffix } },
      select: { id: true },
    });
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(kept.id);
    expect(ids).not.toContain(removed.id);
  });

  it('hides soft-deleted rows from findUnique by id', async () => {
    const venue = await makeVenue('unique-id');
    await prisma.venue.delete({ where: { id: venue.id } });

    await expect(prisma.venue.findUnique({ where: { id: venue.id } })).resolves.toBeNull();
  });

  it('hides soft-deleted rows from findUnique by slug', async () => {
    // The slug path is the one that matters most: it is how every public
    // page resolves its content.
    const venue = await makeVenue('unique-slug');
    await prisma.venue.delete({ where: { id: venue.id } });

    await expect(prisma.venue.findUnique({ where: { slug: venue.slug } })).resolves.toBeNull();
  });

  it('excludes soft-deleted rows from count', async () => {
    const before = await prisma.venue.count({ where: { slug: { contains: suffix } } });
    const venue = await makeVenue('counted');
    expect(await prisma.venue.count({ where: { slug: { contains: suffix } } })).toBe(before + 1);

    await prisma.venue.delete({ where: { id: venue.id } });
    expect(await prisma.venue.count({ where: { slug: { contains: suffix } } })).toBe(before);
  });

  it('scopes deleteMany to live rows and stamps them all', async () => {
    const a = await makeVenue('many-a');
    const b = await makeVenue('many-b');

    await prisma.venue.deleteMany({ where: { id: { in: [a.id, b.id] } } });

    const remaining = await prisma.venue.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(remaining).toHaveLength(0);

    const trashed = await prisma.venue.findMany({
      where: { id: { in: [a.id, b.id] }, deletedAt: { not: null } },
    });
    expect(trashed).toHaveLength(2);
  });

  it('honours an explicit deletedAt filter so the trash view works', async () => {
    const venue = await makeVenue('trash-view');
    await prisma.venue.delete({ where: { id: venue.id } });

    const trash = await prisma.venue.findMany({
      where: { slug: { contains: suffix }, deletedAt: { not: null } },
      select: { id: true },
    });

    expect(trash.map((r) => r.id)).toContain(venue.id);
  });

  it('honours a deletedAt filter nested in a boolean combinator', async () => {
    const venue = await makeVenue('nested-filter');
    await prisma.venue.delete({ where: { id: venue.id } });

    const rows = await prisma.venue.findMany({
      where: { AND: [{ deletedAt: { not: null } }, { slug: { contains: suffix } }] },
      select: { id: true },
    });

    expect(rows.map((r) => r.id)).toContain(venue.id);
  });

  it('restores a soft-deleted row', async () => {
    const venue = await makeVenue('restorable');
    await prisma.venue.delete({ where: { id: venue.id } });
    await expect(prisma.venue.findUnique({ where: { id: venue.id } })).resolves.toBeNull();

    await prisma.venue.update({
      where: { id: venue.id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });

    const restored = await prisma.venue.findUnique({ where: { id: venue.id } });
    expect(restored).not.toBeNull();
    expect(restored?.deletedAt).toBeNull();
  });

  it('permits a genuine DELETE only inside runWithHardDelete', async () => {
    const venue = await makeVenue('purgeable');
    await prisma.venue.delete({ where: { id: venue.id } });

    await runWithHardDelete(async () => {
      await prisma.venue.delete({ where: { id: venue.id } });
    });

    // Gone entirely, not merely stamped.
    const anywhere = await prisma.venue.findFirst({
      where: { id: venue.id, deletedAt: { not: null } },
    });
    expect(anywhere).toBeNull();
  });

  it('leaves models without a deletedAt column alone', async () => {
    // Genre has no deletedAt, so delete must remain a real delete rather
    // than failing on a column that does not exist.
    const genre = await prisma.genre.create({
      data: { slug: `genre-${suffix}`, name: `Genre ${suffix}` },
    });

    await prisma.genre.delete({ where: { id: genre.id } });

    await expect(prisma.genre.findUnique({ where: { id: genre.id } })).resolves.toBeNull();
  });
});

describe('audit stamping', () => {
  it('stamps createdBy and updatedBy from the request context', async () => {
    const actor = 'user_test_actor';

    const venue = await runWithDbContext({ userId: actor }, () => makeVenue('audited'));

    expect(venue.createdBy).toBe(actor);
    expect(venue.updatedBy).toBe(actor);
  });

  it('records a different actor on update while preserving createdBy', async () => {
    const author = 'user_author';
    const editor = 'user_editor';

    const venue = await runWithDbContext({ userId: author }, () => makeVenue('reassigned'));

    const updated = await runWithDbContext({ userId: editor }, () =>
      prisma.venue.update({ where: { id: venue.id }, data: { capacity: 400 } }),
    );

    expect(updated.createdBy).toBe(author);
    expect(updated.updatedBy).toBe(editor);
  });

  it('attributes system operations rather than leaving a null actor', async () => {
    const venue = await runWithDbContext({ system: true }, () => makeVenue('system-actor'));

    expect(venue.createdBy).toBe('system');
  });

  it('leaves the actor null outside any request context', async () => {
    const venue = await makeVenue('no-context');

    expect(venue.createdBy).toBeNull();
  });

  it('survives a lazily-returned PrismaPromise', async () => {
    // Regression guard. PrismaPromise does not execute until awaited, so a
    // callback that RETURNS the promise rather than awaiting it used to hand
    // the un-started query out of the AsyncLocalStorage scope and lose the
    // stamp with no error anywhere. runWithDbContext must await internally.
    const venue = await runWithDbContext({ userId: 'user_lazy' }, () =>
      prisma.venue.create({
        data: {
          slug: `lazy-${suffix}`,
          name: `lazy ${suffix}`,
          city: 'Bengaluru',
          country: 'India',
          status: 'DRAFT',
        },
      }),
    );

    expect(venue.createdBy).toBe('user_lazy');
    expect(venue.updatedBy).toBe('user_lazy');
  });
});

describe('anyDeletionState', () => {
  // A soft-deleted row still occupies its unique `slug` at the database
  // level — soft delete only rewrites `DELETE` into an `UPDATE`, it does not
  // relax the constraint. A plain `findUnique`/`findFirst` is narrowed by the
  // soft-delete extension to `deletedAt: null`, so it reports that slug as
  // free — and `SlugService`'s auto-generated path then hands back a slug it
  // believes is guaranteed available, which the database immediately
  // rejects. This is the bug `anyDeletionState()` exists to close; found
  // while building the Venues module, but it silently applied to every
  // soft-deletable model's uniqueness pre-check, including the already-
  // shipped `Personas.isSlugTaken`.
  it('finds a soft-deleted row that an ordinary query would hide', async () => {
    const venue = await makeVenue('any-deletion-state');
    await prisma.venue.delete({ where: { id: venue.id } }); // rewritten to soft delete

    const invisible = await prisma.venue.findFirst({ where: { slug: venue.slug } });
    expect(invisible, 'the soft-delete extension is expected to hide this').toBeNull();

    const visible = await prisma.venue.findFirst({
      where: { slug: venue.slug, ...anyDeletionState() },
    });
    expect(visible?.id).toBe(venue.id);
  });

  it('still finds a live row', async () => {
    const venue = await makeVenue('any-deletion-state-live');

    const found = await prisma.venue.findFirst({
      where: { slug: venue.slug, ...anyDeletionState() },
    });

    expect(found?.id).toBe(venue.id);
  });
});
