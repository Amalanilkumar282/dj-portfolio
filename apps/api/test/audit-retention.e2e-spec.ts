import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuditAction, runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';
import { AUDIT_LOG_MAX_ROWS, AuditService } from '../src/modules/audit/audit.service';

import { createTestApp } from './harness';

/**
 * The audit table's row cap — `AUDIT_LOG_MAX_ROWS` rows kept, oldest
 * discarded first, like a ring buffer. Deliberately a row count, not a time
 * window: this project runs on a small managed-Postgres free tier, and a
 * cap bounds storage in a way "2 years" never could.
 *
 * Exercised through `AuditService`, never `AuditRepository` directly —
 * `AuditRepository` is this module's own, but importing it from outside the
 * module (as this spec, in `test/`, is) is exactly the cross-module access
 * `dj/prisma-only-in-repositories`'s sibling `no-restricted-imports` rule
 * exists to catch. `AuditService.trimToLatest`/`trimToLatestLocked` are
 * thin pass-throughs kept public for this reason.
 *
 * The fixture strategy below is chosen to never touch or depend on the
 * *real* rows already in this live database: every fixture is backdated to
 * ~13.7 years in the past (`NOW() - INTERVAL '5000 days'`), which is older
 * than any row this project could possibly have produced, so fixtures
 * always sort to the very tail of the global `createdAt DESC` ordering.
 * `trimToLatest(realCount + K)` then provably keeps every real row and
 * exactly the K newest fixtures — no matter how many real rows already
 * exist, and without ever deleting one of them.
 *
 * Requires Postgres with migrations and `seed:system`.
 */

const MARKER = 'e2e-audit-retention';

let app: INestApplication;
let prisma: PrismaService;
let auditService: AuditService;

async function removeFixtures(): Promise<void> {
  await runWithHardDelete(async () => {
    await prisma.client.auditLog.deleteMany({ where: { entityType: MARKER } });
  });
}

/** Inserts `count` fixture rows, all backdated to the same far-past instant. */
async function insertAncientFixtures(prefix: string, count: number): Promise<void> {
  if (count === 0) return;
  await prisma.client.auditLog.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      action: AuditAction.CREATE,
      entityType: MARKER,
      entityId: `${prefix}-${String(i)}`,
    })),
  });
  await prisma.client.$executeRaw`
    UPDATE "audit_logs" SET "createdAt" = NOW() - INTERVAL '5000 days'
    WHERE "entityType" = ${MARKER} AND "entityId" LIKE ${`${prefix}-%`}`;
}

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);
  auditService = app.get(AuditService);
});

// Every test builds its own fixture set and reasons about "the newest K of
// them" — leftover fixtures from a previous test, tied on the same
// backdated timestamp, would make that ambiguous (cuid2 ids are not
// creation-ordered, so which tied row "wins" isn't predictable). A clean
// slate before each test is what keeps every assertion below exact.
beforeEach(async () => {
  await removeFixtures();
});

afterAll(async () => {
  await removeFixtures();
  await app.close();
});

describe('audit log row cap', () => {
  it('keeps only the newest maxRows rows, deleting the rest — real rows untouched', async () => {
    const totalBefore = await prisma.client.auditLog.count();

    await insertAncientFixtures('trim', 5);

    // Keep every real row (all of them rank above these ancient fixtures)
    // plus exactly the 3 newest fixtures.
    const result = await auditService.trimToLatest(totalBefore + 3);

    expect(result.deleted).toBe(2);

    const remainingFixtures = await prisma.client.auditLog.count({
      where: { entityType: MARKER },
    });
    expect(remainingFixtures).toBe(3);

    const totalAfter = await prisma.client.auditLog.count();
    expect(totalAfter).toBe(totalBefore + 3); // no real row was touched
  });

  it('the locked variant does the same trim and reports it ran', async () => {
    // Unfiltered count, exactly like the previous test — NOT
    // `{ entityType: { not: MARKER } }`. Prisma translates `{ not: X }` on a
    // nullable column to a plain SQL `<>`, which (three-valued NULL logic)
    // excludes every row where `entityType` is NULL — and a large share of
    // this table's real rows are exactly that: LOGIN/LOGOUT/TOKEN_REFRESH
    // audit rows carry no entityType. That filtered count undercounted the
    // real total, so the cap computed from it was too low, and the very
    // first version of this test deleted real historical rows it should
    // never have touched. Confirmed and fixed live: see STATUS.md.
    const totalBefore = await prisma.client.auditLog.count();

    await insertAncientFixtures('locked', 4);

    const result = await auditService.trimToLatestLocked(totalBefore + 1);

    expect(result.ran).toBe(true);
    expect(result.deleted).toBe(3);

    const remainingFixtures = await prisma.client.auditLog.count({
      where: { entityType: MARKER, entityId: { startsWith: 'locked-' } },
    });
    expect(remainingFixtures).toBe(1);

    const totalAfter = await prisma.client.auditLog.count();
    expect(totalAfter).toBe(totalBefore + 1); // no real row was touched
  });

  it('is a no-op once the table is already at or under the cap', async () => {
    const total = await prisma.client.auditLog.count();
    const result = await auditService.trimToLatest(total + 100); // cap far above the real total

    expect(result.deleted).toBe(0);
  });

  it('AuditService.record() trims automatically — every write stays under the cap', async () => {
    const totalBefore = await prisma.client.auditLog.count();

    await auditService.record({ action: AuditAction.CREATE, entityType: MARKER, entityId: 'w1' });
    await auditService.record({ action: AuditAction.CREATE, entityType: MARKER, entityId: 'w2' });
    await auditService.record({ action: AuditAction.CREATE, entityType: MARKER, entityId: 'w3' });

    const totalAfter = await prisma.client.auditLog.count();

    // The table can only ever have grown by exactly 3 (nothing to trim,
    // since real usage on a dev database is nowhere near the cap) — proving
    // the per-write call ran without over- or under-deleting.
    expect(totalAfter).toBe(totalBefore + 3);
    expect(totalAfter).toBeLessThanOrEqual(AUDIT_LOG_MAX_ROWS);

    // The three rows just written are always the newest, so they must
    // survive regardless of how close to the cap the table is.
    const written = await prisma.client.auditLog.findMany({
      where: { entityType: MARKER, entityId: { in: ['w1', 'w2', 'w3'] } },
      select: { entityId: true },
    });
    expect(written.map((r) => r.entityId).sort()).toEqual(['w1', 'w2', 'w3']);
  });
});
