import { ContentStatus } from '@prisma/client';

/**
 * Publish-state filters.
 *
 * Deliberately a helper rather than a Prisma extension. Unlike soft delete —
 * where a leaked row is always a bug — publish state is legitimately
 * different per caller: the public API wants PUBLISHED only, the admin wants
 * everything, and draft-mode preview wants a specific draft. Making it
 * implicit would mean fighting the extension on every admin query.
 *
 * The rule is enforced instead by the split controller layout: every
 * `*.controller.ts` (public) composes `publishedWhere()` into its repository
 * calls, while `*.admin.controller.ts` does not.
 *
 * See docs/02-architecture/backend.md
 */

export interface PublishedWhereOptions {
  /**
   * Include rows whose `scheduledAt` has passed but which the five-minute publish
   * cron has not flipped yet. Off by default: the cron is the single writer
   * of publish state, so reads stay consistent with what the sitemap and the
   * cache tags believe is live.
   */
  includeDuePublish?: boolean;
  /** Draft-mode preview: additionally allow this specific row through. */
  previewId?: string;
}

/**
 * The canonical "what the public may see" predicate.
 *
 * Spread into a Prisma `where`:
 *   `prisma.event.findMany({ where: { ...publishedWhere(), isPast: false } })`
 *
 * `deletedAt` is omitted on purpose — the soft-delete extension adds it, and
 * duplicating it here would suppress that extension via
 * `hasExplicitDeletedAtFilter`.
 */
export function publishedWhere(options: PublishedWhereOptions = {}): Record<string, unknown> {
  const { includeDuePublish = false, previewId } = options;

  const live: Record<string, unknown> = { status: ContentStatus.PUBLISHED };

  const clauses: Record<string, unknown>[] = [live];

  if (includeDuePublish) {
    clauses.push({
      status: ContentStatus.DRAFT,
      scheduledAt: { not: null, lte: new Date() },
    });
  }

  const visible = clauses.length === 1 ? live : { OR: clauses };

  if (previewId == null) return visible;

  // Preview widens rather than replaces, so a shared preview link to an
  // already-published page still renders.
  return { OR: [visible, { id: previewId }] };
}

/**
 * Narrows a fetched row union to published rows.
 *
 * Useful after an `include` that cannot carry its own `where` — for example
 * asserting that a track pulled through a playlist relation is itself live.
 */
export function publishedOnly<T extends { status: ContentStatus; deletedAt?: Date | null }>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => row.status === ContentStatus.PUBLISHED && row.deletedAt == null);
}
