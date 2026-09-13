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
 * Writes the audit trail.
 *
 * Actor, IP, user agent and correlation id are read from the ambient request
 * context, so callers pass only what is specific to the event. That is the
 * whole reason `RequestContextMiddleware` exists.
 *
 * **Writes never throw.** A failure to record an audit row must not fail the
 * operation the user just completed successfully — but it is logged at error
 * level, because a silent gap in the trail is its own problem.
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
}
