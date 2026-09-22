import { Injectable, Logger } from '@nestjs/common';

import type { AuditAction } from '@dj/db';

import { RequestContextService } from '../../common/services/request-context.service';

import { AuditRepository, type AuditQuery, type AuditWrite } from './audit.repository';

/** What a caller supplies. Actor, ip and requestId come from the context. */
export interface AuditInput {
  action: AuditAction;
  entityType?: string | undefined;
  entityId?: string | undefined;
  diff?: unknown;
  metadata?: unknown;
  /** Explicit override, for auth flows where there is no authenticated actor yet. */
  actorId?: string | undefined;
  actorEmail?: string | undefined;
}

/**
 * The trail is capped at this many rows, not kept for a length of time — the
 * oldest row is discarded to make room for the newest, like a ring buffer.
 * Chosen over a time-based retention policy specifically to bound storage on
 * a small managed-Postgres plan: 2 years of history has no fixed size, 1,000
 * rows always does.
 *
 * This is a real trade-off, not a free lunch: on a busy admin day the trail
 * can roll over within that same day, so "what did we change last month" may
 * no longer be answerable from here. Nothing else in this app depends on
 * long-lived audit history today (no compliance export, no DSAR use of this
 * table per docs/05-operations/runbooks/dsar.md), which is what makes the
 * trade acceptable. See ADR 0025 if that ever stops being true.
 */
export const AUDIT_LOG_MAX_ROWS = 1000;

/**
 * Writes the audit trail.
 *
 * Actor, IP, user agent and correlation id are read from the ambient request
 * context, so callers pass only what is specific to the event. That is the
 * whole reason `RequestContextMiddleware` exists.
 *
 * **Writes never throw.** A failure to record an audit row, or to trim the
 * table back down to `AUDIT_LOG_MAX_ROWS` afterwards, must not fail the
 * operation the user just completed successfully — but both are logged at
 * error level, because a silent gap in the trail (or a silently uncapped
 * table) is its own problem.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly repository: AuditRepository,
    private readonly context: RequestContextService,
  ) {}

  async record(input: AuditInput): Promise<void> {
    const context = this.context.get();

    const write: AuditWrite = {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorId: input.actorId ?? context?.userId,
      actorEmail: input.actorEmail ?? context?.userEmail,
      diff: input.diff,
      metadata: input.metadata,
      ip: context?.ip,
      userAgent: context?.userAgent,
      requestId: context?.requestId,
    };

    try {
      await this.repository.create(write);
    } catch (error) {
      this.logger.error(
        `audit_write_failed action=${input.action} entity=${input.entityType ?? '-'}:${input.entityId ?? '-'}`,
        error instanceof Error ? error.stack : String(error),
      );
      return; // Nothing to trim if the insert itself never landed.
    }

    // Trimmed on every write rather than periodically: the table can never
    // grow past `AUDIT_LOG_MAX_ROWS + 1` between calls, which is what keeps
    // this cheap — always a small scan over a ~1,000-row table, never one
    // over the project's full lifetime of audit history. A failure here
    // does not roll back the insert above; the nightly cron catches up.
    try {
      await this.repository.trimToLatest(AUDIT_LOG_MAX_ROWS);
    } catch (error) {
      this.logger.error(
        'audit_trim_failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Builds a before/after diff of scalar fields only.
   *
   * Relations and nested objects are excluded on purpose: they bloat the row,
   * and a nested payload is where a secret hides. Only fields that actually
   * changed are included, so the diff reads as a changelog.
   */
  buildDiff(
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): { before: Record<string, unknown>; after: Record<string, unknown> } | undefined {
    if (!before && !after) return undefined;

    const redacted = new Set([
      'passwordHash',
      'totpSecret',
      'totpRecoveryCodes',
      'tokenHash',
      'confirmToken',
      'unsubscribeToken',
    ]);

    const isScalar = (value: unknown): boolean =>
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value) ||
      value instanceof Date;

    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    const changedBefore: Record<string, unknown> = {};
    const changedAfter: Record<string, unknown> = {};

    for (const key of keys) {
      if (redacted.has(key)) continue;

      const previous = before?.[key];
      const next = after?.[key];

      if (!isScalar(previous) && previous !== undefined) continue;
      if (!isScalar(next) && next !== undefined) continue;

      const same =
        previous instanceof Date && next instanceof Date
          ? previous.getTime() === next.getTime()
          : previous === next;

      if (!same) {
        changedBefore[key] = previous ?? null;
        changedAfter[key] = next ?? null;
      }
    }

    if (Object.keys(changedAfter).length === 0) return undefined;
    return { before: changedBefore, after: changedAfter };
  }

  async list(query: AuditQuery) {
    return this.repository.list(query);
  }

  /**
   * Thin pass-throughs to the repository's trim, exposed here rather than
   * left repository-only so that anything outside this module — an e2e test,
   * a future "compact the audit log now" admin action — goes through the
   * service, per `dj/prisma-only-in-repositories`'s sibling rule that
   * cross-module access never reaches into another module's repository
   * directly. `record()` above already uses the unlocked variant on every
   * write; these exist for callers that aren't already inside a request.
   */
  async trimToLatest(maxRows: number): Promise<{ deleted: number }> {
    return this.repository.trimToLatest(maxRows);
  }

  async trimToLatestLocked(maxRows: number): Promise<{ ran: boolean; deleted: number }> {
    return this.repository.trimToLatestLocked(maxRows);
  }
}
