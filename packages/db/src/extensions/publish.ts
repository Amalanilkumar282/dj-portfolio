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

/**
 * Spread into a `where` to check a uniqueness constraint against **every**
 * row, live or trashed.
 *
 * A soft-deleted row still occupies its `slug` and any other `@unique`
 * column at the database level — soft delete only rewrites `DELETE`, it does
 * not relax the constraint. But the soft-delete extension's automatic
 * `deletedAt: null` narrowing means an ordinary `findUnique({ where: { slug }})`
 * cannot see a trashed row holding that slug, so an uniqueness pre-check
 * reports a false "free" — and `SlugService.resolve()`'s auto-generated path
 * in particular then hands back a slug it believes is guaranteed available,
 * which the database immediately rejects. The caller who never supplied a
 * slug at all gets an unexplained 409 on something that should "just work".
 *
 * `slugTaken` example:
 * ```ts
 * async isSlugTaken(slug: string, exceptId?: string) {
 *   const existing = await this.prisma.client.persona.findFirst({
 *     where: { slug, ...anyDeletionState() },
 *     select: { id: true },
 *   });
 *   return existing != null && existing.id !== exceptId;
 * }
 * ```
 *
 * This must use `findFirst`, not `findUnique` — `findUnique` requires its
 * `where` to be exactly a unique field (or a unique field plus this clause is
 * fine too, since `anyDeletionState()` is additive, not exclusive; either
 * works here, but `findFirst` reads the same either way).
 *
 * The `OR` shape — not a bare `{}` — is deliberate: `hasExplicitDeletedAtFilter`
 * in the soft-delete extension detects "the caller has an opinion" by
 * checking for the literal key `deletedAt`, including inside `OR` branches.
 * A `{ deletedAt: undefined }` would rely on Prisma silently dropping
 * `undefined` filter values, which is real but not the kind of behaviour a
 * reader should have to know to trust this function is doing what it says.
 */
export function anyDeletionState(): Record<string, unknown> {
  return { OR: [{ deletedAt: null }, { deletedAt: { not: null } }] };
}
