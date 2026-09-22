import { Injectable } from '@nestjs/common';

import { type AuditAction, Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditWrite {
  action: AuditAction;
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorId?: string | undefined;
  actorEmail?: string | undefined;
  diff?: unknown;
  metadata?: unknown;
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface AuditQuery {
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorId?: string | undefined;
  action?: AuditAction | undefined;
  take: number;
  cursor?: string | undefined;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(write: AuditWrite): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        action: write.action,
        entityType: write.entityType ?? null,
        entityId: write.entityId ?? null,
        actorId: write.actorId ?? null,
        // Denormalised so the trail survives the actor being deleted.
        actorEmail: write.actorEmail ?? null,
        diff: (write.diff ?? null) as Prisma.InputJsonValue,
        metadata: (write.metadata ?? null) as Prisma.InputJsonValue,
        ip: write.ip ?? null,
        userAgent: write.userAgent ?? null,
        requestId: write.requestId ?? null,
      },
    });
  }

  /**
   * Keeps only the `maxRows` most recent audit rows, deleting everything
   * older — a hard row cap ("overwrite" semantics: the oldest row is
   * discarded to make room for the newest), not a time-based policy.
   *
   * Called after every single insert (`AuditService.record`), which is what
   * makes this cheap rather than a maintenance burden: the table can never
   * grow past `maxRows + 1` between calls, so this is always a `LIMIT`/
   * `OFFSET` scan over a table of at most ~1,000 rows, never over the
   * project's full lifetime of audit history. `ORDER BY "createdAt" DESC,
   * "id" DESC` breaks ties deterministically for rows created in the same
   * millisecond, so which row survives a tie is never ambiguous.
   *
   * Also run nightly by `AuditRetentionCron`, advisory-locked, as a
   * safety net — not because the per-write call is expected to fall behind,
   * but because a crash mid-request, a future write path that bypasses
   * `AuditService.record`, or a bulk import could otherwise leave the table
   * over cap indefinitely with nothing to notice.
   */
  async trimToLatest(maxRows: number): Promise<{ deleted: number }> {
    const result = await this.prisma.client.$executeRaw`
      DELETE FROM "audit_logs"
      WHERE id IN (
        SELECT id FROM "audit_logs"
        ORDER BY "createdAt" DESC, id DESC
        OFFSET ${maxRows}
      )`;

    return { deleted: result };
  }

  /**
   * The same trim as `trimToLatest`, but advisory-locked — used only by the
   * nightly `AuditRetentionCron` safety net, never by the per-write path
   * (which is cheap enough, and frequent enough, that a lock would only add
   * contention for no benefit: two overlapping trims are harmless, since
   * DELETE...OFFSET is idempotent regardless of how many times it runs).
   * `pg_try_advisory_xact_lock` is transaction-scoped, releasing on commit,
   * which keeps it safe under pgbouncer transaction pooling.
   */
  async trimToLatestLocked(maxRows: number): Promise<{ ran: boolean; deleted: number }> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const [lockRow] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('audit-log-retention')) AS locked`;

        if (!lockRow?.locked) return { ran: false, deleted: 0 };

        const deleted = await tx.$executeRaw`
          DELETE FROM "audit_logs"
          WHERE id IN (
            SELECT id FROM "audit_logs"
            ORDER BY "createdAt" DESC, id DESC
            OFFSET ${maxRows}
          )`;

        return { ran: true, deleted };
      },
      { timeout: 30_000, maxWait: 5_000 },
    );
  }

  async list(query: AuditQuery) {
    return this.prisma.client.auditLog.findMany({
      where: {
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.action ? { action: query.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
    });
  }
}
