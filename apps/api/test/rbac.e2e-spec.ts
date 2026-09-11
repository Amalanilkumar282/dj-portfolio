import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { RbacService } from '../src/modules/rbac/rbac.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * The RBAC matrix — the other half of the Phase 3 exit criteria — plus the
 * publish workflow, pagination and query contracts from Phase 4.
 *
 * The property under test is that **permission, not authentication, decides
 * access**. A signed-in VIEWER must be refused a write just as firmly as an
 * anonymous caller, and the refusal must be a 403 (you are known, and not
 * allowed) rather than a 401 (we do not know you) — the admin UI renders
 * completely differently for each, and a 401 signs the user out.
 *
 * Test users are minted through the app's own services rather than over HTTP,
 * because there is no user-management API yet (Phase 6). They use a reserved
 * email prefix and are removed afterwards.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-rbac';
const PASSWORD = 'e2e-Password!2026';

let app: INestApplication;

/**
 * This spec's HTTP client. Each call gets a fresh address — see
 * `nextClientIp` in harness.ts for why that matters.
 */
const http = () => client(app);
let prisma: PrismaService;

/** Access tokens by role key, minted once in beforeAll. */
const tokens = new Map<string, string>();

/** Creates a user holding exactly one seeded role, and returns its token. */
async function mintUser(roleKey: string): Promise<string> {
  const passwords = app.get(PasswordService);
  const rbac = app.get(RbacService);

  const role = await rbac.findRoleByKey(roleKey);
  if (!role) throw new Error(`Role ${roleKey} is not seeded. Run pnpm db:seed.`);

  const user = await prisma.client.user.create({
    data: {
      email: `${PREFIX}-${roleKey.toLowerCase()}@example.test`,
      name: `E2E ${roleKey}`,
      passwordHash: await passwords.hash(PASSWORD),
      isActive: true,
    },
  });

  await rbac.assignRole(user.id, role.id);

  const login = await http()
    .post(`${base}/auth/login`)
    .send({ email: user.email, password: PASSWORD })
    .expect(200);

  return String(body(login).accessToken);
}

/**
 * Removes the fixture users for real.
 *
 * `runWithHardDelete` is required, not tidiness: the soft-delete extension
 * rewrites `deleteMany` into an `UPDATE` stamping `deletedAt`, so a plain
 * delete leaves the row — and its unique email — in place. The next run then
 * fails on a unique-constraint violation that looks nothing like the cause.
 * These rows are fixtures, not content, which is what makes this one of the
 * few legitimate hard deletes outside the nightly purge.
 */
async function removeFixtureUsers(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);

  // Left over from a previous interrupted run.
  await removeFixtureUsers();

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({
      email: requiredEnv('ADMIN_SEED_EMAIL'),
      password: requiredEnv('ADMIN_SEED_PASSWORD'),
    })
    .expect(200);

  tokens.set('SUPER_ADMIN', String(body(owner).accessToken));
  tokens.set('EDITOR', await mintUser('EDITOR'));
  tokens.set('VIEWER', await mintUser('VIEWER'));
});

afterAll(async () => {
  await removeFixtureUsers();
  await app.close();
});

function as(role: string): string {
  const token = tokens.get(role);
  if (!token) throw new Error(`No token minted for ${role}`);
  return `Bearer ${token}`;
}

/** The persona rows, as the admin list returns them. */
interface AdminPersona {
  id: string;
  slug: string;
  sortIndex: number;
}

async function adminPersonas(): Promise<AdminPersona[]> {
  const response = await http()
    .get(`${base}/admin/personas`)
    .set('authorization', as('SUPER_ADMIN'))
    .expect(200);

  return body(response).data as AdminPersona[];
}

async function anyPersonaId(): Promise<string> {
  const [first] = await adminPersonas();
  if (!first) throw new Error('No personas seeded. Run pnpm db:seed.');
  return first.id;
}

function slugsOf(response: { body: unknown }): string[] {
  return (body(response).data as { slug: string }[]).map((row) => row.slug);
}

/**
 * Runs a test that writes a persona's tagline, then puts it back.
 *
 * The seeded content is the DJ's real copy, harvested from the legacy site. A
 * test that PATCHes a tagline and walks away leaves "set by the owner" in the
 * database — and, once the web app is wired up, on the live page.
 *
 * The presence check is not defensive padding. `PATCH { tagline: undefined }`
 * serialises to `{}`, so if the field is ever absent from the admin response
 * the restore becomes a **silent no-op** and the pollution ships. That is
 * exactly what happened while `tagline` was writable but not readable: three
 * personas were left overwritten and every test still passed.
 */
async function withRestoredTagline(id: string, run: () => Promise<void>): Promise<void> {
  const before = await http()
    .get(`${base}/admin/personas/${id}`)
    .set('authorization', as('SUPER_ADMIN'))
    .expect(200);

  expect(
    body(before),
    'the admin response has no `tagline`, so it cannot be restored — see the note above',
  ).toHaveProperty('tagline');

  const tagline = (body(before).tagline ?? null) as string | null;

  try {
    await run();
  } finally {
    const restored = await http()
      .patch(`${base}/admin/personas/${id}`)
      .set('authorization', as('SUPER_ADMIN'))
      .send({ tagline })
      .expect(200);

    // Assert the restore actually took, rather than trusting the 200.
    expect(body(restored).tagline ?? null).toBe(tagline);
  }
}

describe('the permission matrix', () => {
  it('lets every signed-in role read admin content', async () => {
    for (const role of ['SUPER_ADMIN', 'EDITOR', 'VIEWER']) {
      await http().get(`${base}/admin/personas`).set('authorization', as(role)).expect(200);
    }
  });

  it('refuses a VIEWER a write with 403, not 401', async () => {
    const id = await anyPersonaId();

    const response = await http()
      .patch(`${base}/admin/personas/${id}`)
      .set('authorization', as('VIEWER'))
      .send({ tagline: 'a viewer should not be able to write this' })
      .expect(403);

    expect(body(response).code).toBe('INSUFFICIENT_PERMISSIONS');
    // Traceable, so a confused user's report can be found in the logs.
    expect(body(response).requestId).toBeTypeOf('string');
  });

  it('refuses a VIEWER every publish-workflow transition', async () => {
    const id = await anyPersonaId();

    for (const action of ['publish', 'unpublish', 'archive']) {
      await http()
        .patch(`${base}/admin/personas/${id}/${action}`)
        .set('authorization', as('VIEWER'))
        .expect(403);
    }
  });

  it('refuses a VIEWER a delete', async () => {
    const id = await anyPersonaId();

    await http()
      .delete(`${base}/admin/personas/${id}`)
      .set('authorization', as('VIEWER'))
      .expect(403);
  });

  it('lets an EDITOR write', async () => {
    const id = await anyPersonaId();

    await withRestoredTagline(id, async () => {
      await http()
        .patch(`${base}/admin/personas/${id}`)
        .set('authorization', as('EDITOR'))
        .send({ tagline: 'edited by the e2e editor' })
        .expect(200);
    });
  });

  it('grants the owner what the viewer is refused', async () => {
    // The matrix is only meaningful if the permitted case actually passes;
    // otherwise every 403 above could be an unrelated failure.
    const id = await anyPersonaId();

    await withRestoredTagline(id, async () => {
      await http()
        .patch(`${base}/admin/personas/${id}`)
        .set('authorization', as('SUPER_ADMIN'))
        .send({ tagline: 'set by the owner' })
        .expect(200);
    });
  });

  it('scopes each role to the permissions the system seed intends', async () => {
    // Asserted against the resolved permission set rather than by calling a
    // forbidden endpoint, because the roles that a request could prove this
    // with (users, settings) have no API until Phase 6 — and because probing
    // a *destructive* endpoint to prove a role lacks it is only
    // non-destructive while the assumption holds. It did not: an earlier
    // version of this test assumed EDITOR lacked `persona:delete`, so the
    // request it expected to be refused succeeded and soft-deleted seeded
    // content, which then failed two unrelated tests downstream.
    const permissionsFor = async (role: string): Promise<string[]> => {
      const me = await http().get(`${base}/auth/me`).set('authorization', as(role)).expect(200);

      return body(me).permissions as string[];
    };

    const editor = await permissionsFor('EDITOR');
    const viewer = await permissionsFor('VIEWER');

    // EDITOR manages content, but never users, roles or site configuration.
    expect(editor).toContain('persona:write');
    expect(editor).toContain('persona:publish');
    expect(editor.filter((key) => key.startsWith('user:'))).toEqual([]);
    expect(editor.filter((key) => key.startsWith('role:'))).toEqual([]);
    expect(editor.filter((key) => key.startsWith('settings:'))).toEqual([]);
    // Deleting media cascades into published pages, so it stays with the owner.
    expect(editor).not.toContain('media:delete');

    // VIEWER is strictly read-only. Asserted as a property over the whole set,
    // so a permission added later cannot quietly grant it a write.
    expect(viewer.length).toBeGreaterThan(0);
    expect(viewer.every((key) => key.endsWith(':read'))).toBe(true);
  });
});

describe('admin routing', () => {
  it('routes /reorder to reorder, not to :id', async () => {
    // Regression test. `@Patch(':id')` declared above `@Patch('reorder')`
    // silently swallows this path and tries to update a persona whose id is
    // the literal string "reorder" — which surfaces as a 404 that reads like
    // a missing record rather than a routing bug.
    // Captures the existing ordering and puts it back. An earlier version did
    // not, and permanently rewrote the seeded sortIndex values — which broke a
    // @dj/db integration test asserting the canonical persona order, in a
    // different package, with nothing pointing back here.
    const original = await adminPersonas();
    const restore = original.map((row) => ({ id: row.id, sortIndex: row.sortIndex }));

    const reorder = (entries: { id: string; sortIndex: number }[]) =>
      http()
        .patch(`${base}/admin/personas/reorder`)
        .set('authorization', as('SUPER_ADMIN'))
        .send({ entries });

    try {
      // Reversed, so the call demonstrably changes something.
      await reorder(
        [...original].reverse().map((row, index) => ({ id: row.id, sortIndex: index })),
      ).expect(204);

      const reordered = await adminPersonas();
      expect(reordered.map((row) => row.slug)).toEqual([...original].reverse().map((r) => r.slug));
    } finally {
      await reorder(restore).expect(204);
    }

    expect((await adminPersonas()).map((row) => row.slug)).toEqual(original.map((r) => r.slug));
  });
});

describe('the publish workflow', () => {
  it('removes an unpublished persona from the public site and restores it', async () => {
    const publicList = await http().get(`${base}/personas`).expect(200);
    const [slug] = slugsOf(publicList);
    if (!slug) throw new Error('No published personas seeded.');

    const target = (await adminPersonas()).find((row) => row.slug === slug);
    if (!target) throw new Error(`Persona ${slug} missing from the admin list.`);

    await http()
      .patch(`${base}/admin/personas/${target.id}/unpublish`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(200);

    expect(slugsOf(await http().get(`${base}/personas`).expect(200))).not.toContain(slug);

    // A draft 404s publicly rather than 403ing: its existence is not
    // disclosed to anonymous callers.
    await http().get(`${base}/personas/${slug}`).expect(404);

    await http()
      .patch(`${base}/admin/personas/${target.id}/publish`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(200);

    expect(slugsOf(await http().get(`${base}/personas`).expect(200))).toContain(slug);
  });

  it('soft-deletes and restores, leaving the content exactly as it was', async () => {
    // The only test here that mutates seeded content destructively, so it
    // restores in a `finally`: a failure mid-way would otherwise leave a
    // persona missing from the public site and break every later test in a
    // way that points nowhere near this one.
    const target = (await adminPersonas()).at(-1);
    if (!target) throw new Error('No personas seeded.');

    try {
      await http()
        .delete(`${base}/admin/personas/${target.id}`)
        .set('authorization', as('SUPER_ADMIN'))
        .expect(204);

      // Gone from the public site, but still present for the admin — that is
      // the whole point of a soft delete.
      expect(slugsOf(await http().get(`${base}/personas`).expect(200))).not.toContain(target.slug);
    } finally {
      await http()
        .post(`${base}/admin/personas/${target.id}/restore`)
        .set('authorization', as('SUPER_ADMIN'))
        .expect(200);
    }

    expect(slugsOf(await http().get(`${base}/personas`).expect(200))).toContain(target.slug);
  });

  it('rejects an invalid status transition with 409', async () => {
    const id = await anyPersonaId();

    // Ensure it is published, then publish again. That is not a no-op, it is
    // a contradiction — accepting it silently would hide a bug in whatever
    // issued it twice.
    await http()
      .patch(`${base}/admin/personas/${id}/publish`)
      .set('authorization', as('SUPER_ADMIN'));

    const conflict = await http()
      .patch(`${base}/admin/personas/${id}/publish`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(409);

    expect(body(conflict).code).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('query contracts', () => {
  it('reports offset pagination metadata for admin tables', async () => {
    const response = await http()
      .get(`${base}/admin/personas?page=1&perPage=2`)
      .set('authorization', as('SUPER_ADMIN'))
      .expect(200);

    const pagination = body(response).meta?.pagination as Record<string, unknown>;
    expect(pagination.mode).toBe('offset');
    expect(pagination.page).toBe(1);
    // An admin table needs "page 7 of 23", which a cursor cannot express.
    expect(pagination.totalCount).toBeTypeOf('number');
    expect((body(response).data as unknown[]).length).toBeLessThanOrEqual(2);
  });

  it('reports cursor pagination metadata for public lists', async () => {
    const response = await http().get(`${base}/personas?limit=2`).expect(200);

    const pagination = body(response).meta?.pagination as Record<string, unknown>;
    expect(pagination.mode).toBe('cursor');
    expect(pagination).toHaveProperty('nextCursor');
  });

  it('actually advances when the cursor is passed back', async () => {
    // The regression this guards: a service that accepts `cursor` and never
    // applies it still returns a plausible `nextCursor`, so page 2 is page 1
    // again and infinite scroll loops forever with no error anywhere.
    const first = await http().get(`${base}/personas?limit=1`).expect(200);
    const pagination = body(first).meta?.pagination as { hasMore: boolean; nextCursor: string };

    expect(pagination.hasMore).toBe(true);

    const second = await http()
      .get(`${base}/personas?limit=1&cursor=${encodeURIComponent(pagination.nextCursor)}`)
      .expect(200);

    expect(slugsOf(second)[0]).not.toBe(slugsOf(first)[0]);
  });

  it('walks the whole list without repeating or skipping a row', async () => {
    const all = await http().get(`${base}/personas?limit=100`).expect(200);
    const expected = slugsOf(all);

    const seen: string[] = [];
    let cursor: string | null = null;

    // One row per page, which is where an off-by-one in the keyset predicate
    // shows up as a dropped or duplicated row.
    for (let guard = 0; guard <= expected.length; guard += 1) {
      const query = cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
      const page = await http().get(`${base}/personas?limit=1${query}`).expect(200);

      seen.push(...slugsOf(page));

      const pagination = body(page).meta?.pagination as { nextCursor: string | null };
      cursor = pagination.nextCursor;
      if (cursor === null) break;
    }

    expect(seen).toEqual(expected);
  });

  it('rejects an include outside the allowlist', async () => {
    // The N+1 and over-fetch guard: the API physically cannot be asked for an
    // arbitrary relation graph.
    const response = await http().get(`${base}/personas?include=secretTable`).expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');
    expect(body(response).errors?.[0]?.pointer).toContain('/include');
  });

  it('rejects a tampered cursor as a client error, not a 500', async () => {
    await http().get(`${base}/personas?cursor=not-a-cursor`).expect(400);
  });

  it('serves the aggregate page payload within the query budget', async () => {
    // Phase 4's exit criterion is <= 8 queries for this endpoint. Asserted
    // from the header the QueryCountInterceptor emits, so an N+1 introduced
    // by a later `include` fails here rather than in production.
    const response = await http().get(`${base}/personas/felicitous/page`).expect(200);

    const queries = Number(response.headers['x-query-count']);
    expect(queries).toBeGreaterThan(0);
    expect(queries).toBeLessThanOrEqual(8);
  });
});
