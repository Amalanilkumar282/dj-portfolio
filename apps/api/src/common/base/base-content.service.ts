import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
/**
 * The slice of the event bus this base class needs.
 *
 * Structural rather than `EventEmitter2` for two reasons. It keeps a core
 * abstraction independent of a third-party class, so a subclass can be unit
 * tested with a two-line stub instead of a real emitter. And it sidesteps a
 * concrete problem: `@nestjs/event-emitter` re-exports `EventEmitter2` in a
 * shape typescript-eslint resolves as `any`, which silently disabled the
 * type-aware `no-unsafe-call` checks on every `emit` below — the opposite of
 * what naming the concrete type was meant to achieve.
 *
 * `EventEmitter2` satisfies this structurally, so subclasses still inject it.
 */
export interface DomainEventBus {
  emit(event: string, payload: unknown): boolean;
}

import type { ContentChangedEvent, RevalidatableEntity } from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { CONTENT_CHANGED } from '../../infra/revalidation/revalidation.service';
import type { AuditService } from '../../modules/audit/audit.service';
import { ERROR_CODES } from '../problems';

/** The minimum a repository must offer for the publish workflow to work. */
export interface PublishableRepository<T> {
  findByIdForAdmin(id: string): Promise<T | null>;
  updateStatus(
    id: string,
    data: {
      status: ContentStatus;
      publishedAt?: Date | null;
      scheduledAt?: Date | null;
    },
  ): Promise<T>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<T>;
  reorder(entries: { id: string; sortIndex: number }[]): Promise<void>;
}

/** Row shape the workflow reads. Every publishable model has these. */
export interface PublishableRow {
  id: string;
  slug?: string;
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
}

/**
 * Legal status transitions.
 *
 * Enumerated rather than "anything to anything" because two of the illegal
 * moves lose data in ways an editor would not expect: publishing straight from
 * ARCHIVED skips the review that unarchiving implies, and re-publishing an
 * already-published row would reset `publishedAt` and therefore the sitemap
 * `lastmod` for content that did not change.
 */
const ALLOWED_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  [ContentStatus.DRAFT]: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED],
  [ContentStatus.PUBLISHED]: [ContentStatus.DRAFT, ContentStatus.ARCHIVED],
  [ContentStatus.ARCHIVED]: [ContentStatus.DRAFT],
};

/**
 * The publish workflow, shared by every content type.
 *
 * Extracted because all eighteen publishable models need identical
 * publish/unpublish/archive/restore/reorder behaviour, and eighteen
 * near-identical copies would drift — which is exactly what happened to the
 * four persona pages on the site this replaces.
 *
 * Subclasses supply a repository and an entity name; everything else is
 * inherited. Each mutation does three things in order, and the order matters:
 *
 *   1. write the change
 *   2. record the audit row
 *   3. emit `content.changed` so the public page revalidates
 *
 * Emitting before the write would race the web app into re-reading the old
 * row. Skipping the emit leaves the site serving stale content until the
 * weekly backstop cron.
 *
 * See docs/02-architecture/backend.md
 */
export abstract class BaseContentService<T extends PublishableRow> {
  protected abstract readonly repository: PublishableRepository<T>;
  protected abstract readonly audit: AuditService;
  protected abstract readonly events: DomainEventBus;

  /** Matches the RevalidatableEntity union, and drives the tag map. */
  protected abstract readonly entityName: RevalidatableEntity;

  /** Model name for the audit trail, e.g. "Event". */
  protected abstract readonly auditEntityType: string;

  /**
   * The persona a row belongs to, if any.
   *
   * Returning it lets the tag map invalidate that persona's page too — a new
   * track has to appear on `/tnt`, not only on `/music`.
   */
  protected personaSlugOf(_row: T): string | undefined {
    return undefined;
  }

  // ── publish workflow ─────────────────────────────────────────────────────

  async publish(id: string, now: Date): Promise<T> {
    const current = await this.requireForAdmin(id);
    this.assertTransition(current.status, ContentStatus.PUBLISHED);

    const updated = await this.repository.updateStatus(id, {
      status: ContentStatus.PUBLISHED,
      // Set only on first publish, so re-publishing after an unpublish does
      // not rewrite history — and the sitemap lastmod stays honest.
      publishedAt: current.publishedAt ?? now,
      // Cleared: a scheduled row that is published by hand is no longer
      // pending, and leaving it set would make the cron publish it again.
      scheduledAt: null,
    });

    await this.afterMutation(updated, AuditAction.PUBLISH, 'publish', {
      from: current.status,
    });

    return updated;
  }

  async unpublish(id: string): Promise<T> {
    const current = await this.requireForAdmin(id);
    this.assertTransition(current.status, ContentStatus.DRAFT);

    const updated = await this.repository.updateStatus(id, { status: ContentStatus.DRAFT });

    await this.afterMutation(updated, AuditAction.UNPUBLISH, 'unpublish', {
      from: current.status,
    });

    return updated;
  }

  async archive(id: string): Promise<T> {
    const current = await this.requireForAdmin(id);
    this.assertTransition(current.status, ContentStatus.ARCHIVED);

    const updated = await this.repository.updateStatus(id, { status: ContentStatus.ARCHIVED });

    await this.afterMutation(updated, AuditAction.ARCHIVE, 'archive', {
      from: current.status,
    });

    return updated;
  }

  /**
   * Schedules a publish.
   *
   * The row stays DRAFT and the five-minute cron flips it. Keeping the cron as
   * the single writer of publish state is what stops a read path from having
   * to reason about "scheduled but not yet live", and keeps cache tags
   * consistent with what the sitemap believes.
   */
  async schedule(id: string, publishAt: Date, now: Date): Promise<T> {
    const current = await this.requireForAdmin(id);

    if (publishAt <= now) {
      throw new BadRequestException({
        message: 'A scheduled publish time must be in the future.',
        code: ERROR_CODES.VALIDATION_FAILED,
        errors: [{ pointer: '/scheduledAt', message: 'Must be in the future.' }],
      });
    }

    if (current.status === ContentStatus.PUBLISHED) {
      throw new ConflictException({
        message: 'This item is already published. Unpublish it before scheduling.',
        code: ERROR_CODES.INVALID_STATUS_TRANSITION,
      });
    }

    const updated = await this.repository.updateStatus(id, {
      status: ContentStatus.DRAFT,
      scheduledAt: publishAt,
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', {
      scheduledAt: publishAt.toISOString(),
    });

    return updated;
  }

  /**
   * Soft-deletes.
   *
   * The row is never physically removed — the Prisma extension rewrites the
   * delete — so it stays recoverable from the admin trash for 30 days.
   */
  async remove(id: string): Promise<void> {
    const current = await this.requireForAdmin(id);

    await this.repository.softDelete(id);

    await this.audit.record({
      action: AuditAction.DELETE,
      entityType: this.auditEntityType,
      entityId: id,
    });

    this.emitChange(current, 'delete');
  }

  async restore(id: string): Promise<T> {
    const restored = await this.repository.restore(id);

    await this.afterMutation(restored, AuditAction.RESTORE, 'restore');

    return restored;
  }

  /**
   * Applies a whole new ordering in one transaction.
   *
   * One call rather than N, because drag-and-drop produces a full permutation:
   * sending twenty PATCHes would be twenty round trips and would leave the
   * list half-reordered if one failed.
   */
  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    if (entries.length === 0) return;

    const ids = new Set(entries.map((entry) => entry.id));
    if (ids.size !== entries.length) {
      throw new BadRequestException({
        message: 'The same id appears more than once.',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    await this.repository.reorder(entries);

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: this.auditEntityType,
      metadata: { reordered: entries.length },
    });

    // No slug: a reorder affects the list, not one entity.
    this.events.emit(CONTENT_CHANGED, {
      entity: this.entityName,
      id: 'reorder',
      action: 'update',
    } satisfies ContentChangedEvent);
  }

  // ── helpers for subclasses ───────────────────────────────────────────────

  /** Loads a row for an admin write, or 404s. Bypasses the publish filter. */
  protected async requireForAdmin(id: string): Promise<T> {
    const row = await this.repository.findByIdForAdmin(id);

    if (!row) {
      throw new NotFoundException({
        message: `No ${this.auditEntityType} exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }

  /** Audit plus revalidate. Call after every successful mutation. */
  protected async afterMutation(
    row: T,
    action: AuditAction,
    changeAction: ContentChangedEvent['action'],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action,
      entityType: this.auditEntityType,
      entityId: row.id,
      metadata,
    });

    this.emitChange(row, changeAction);
  }

  protected emitChange(row: T, action: ContentChangedEvent['action']): void {
    this.events.emit(CONTENT_CHANGED, {
      entity: this.entityName,
      id: row.id,
      slug: row.slug,
      action,
      personaSlug: this.personaSlugOf(row),
    } satisfies ContentChangedEvent);
  }

  private assertTransition(from: ContentStatus, to: ContentStatus): void {
    if (from === to) {
      throw new ConflictException({
        message: `This item is already ${from.toLowerCase()}.`,
        code: ERROR_CODES.INVALID_STATUS_TRANSITION,
      });
    }

    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new ConflictException({
        message: `Cannot go from ${from.toLowerCase()} to ${to.toLowerCase()}.`,
        code: ERROR_CODES.INVALID_STATUS_TRANSITION,
      });
    }
  }
}
