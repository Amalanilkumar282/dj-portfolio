import { BadRequestException, Injectable } from '@nestjs/common';

import { ERROR_CODES } from '../problems';

/** One field of a sort, as parsed from the `?sort=` query. */
export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * The decoded cursor payload.
 *
 * Holds the full sort tuple, not just an id. See the class comment for why
 * that is not optional.
 */
export interface CursorPayload {
  /** Values of every sort field, in order, for the last row of the page. */
  values: (string | number | null)[];
  /** Tiebreaker. Always the row id. */
  id: string;
}

@Injectable()
export class CursorService {
  /**
   * Encodes a cursor from the last row of a page.
   *
   * **The cursor carries the full sort tuple plus the id, never a bare id.**
   * A bare id only works when the sort is unique. Sort by `startsAt` — which
   * two gigs on the same night share — and a bare-id cursor either skips rows
   * or repeats them, because Prisma has no way to know which of the tied rows
   * the caller meant. The tuple plus an id tiebreaker is total, so pagination
   * is stable even while new content is published mid-scroll.
   */
  encode(row: Record<string, unknown>, sort: SortField[]): string {
    const payload: CursorPayload = {
      values: sort.map((entry) => this.normalise(row[entry.field])),
      id: String(row.id),
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  decode(cursor: string): CursorPayload {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as CursorPayload).values) ||
        typeof (parsed as CursorPayload).id !== 'string'
      ) {
        throw new Error('shape');
      }

      return parsed as CursorPayload;
    } catch {
      // A tampered or stale cursor is the caller's problem, not a 500. The
      // reason is not disclosed because the encoding is an implementation
      // detail clients must not depend on.
      throw new BadRequestException({
        message: 'The pagination cursor is not valid.',
        code: ERROR_CODES.VALIDATION_FAILED,
        errors: [{ pointer: '/cursor', message: 'Invalid or expired cursor.' }],
      });
    }
  }

  /**
   * Builds the Prisma `orderBy` for a sort, always appending the id.
   *
   * The trailing id is what makes the ordering total. Without it, two rows
   * with equal sort values have an undefined relative order, which Postgres
   * is free to vary between queries — and pagination then silently drops rows.
   */
  toOrderBy(sort: SortField[]): Record<string, 'asc' | 'desc'>[] {
    const primaryDirection = sort[0]?.direction ?? 'desc';

    return [...sort.map((entry) => ({ [entry.field]: entry.direction })), { id: primaryDirection }];
  }

  /**
   * Builds a keyset `where` clause from a decoded cursor.
   *
   * Produces the lexicographic "row is after this one" predicate:
   *
   *   (a > a0)
   *   OR (a = a0 AND b > b0)
   *   OR (a = a0 AND b = b0 AND id > id0)
   *
   * Keyset rather than `skip`: OFFSET makes the database walk and discard
   * every skipped row, so page 50 costs fifty times page 1. Keyset seeks
   * straight to the position via the index, which is why every sortable
   * column is required to have one.
   */
  toWhere(payload: CursorPayload, sort: SortField[]): Record<string, unknown> {
    const clauses: Record<string, unknown>[] = [];

    for (let depth = 0; depth < sort.length; depth += 1) {
      const clause: Record<string, unknown> = {};

      // Every earlier field must be exactly equal.
      for (let i = 0; i < depth; i += 1) {
        const entry = sort[i];
        if (entry) clause[entry.field] = payload.values[i];
      }

      const current = sort[depth];
      if (!current) continue;

      const operator = current.direction === 'asc' ? 'gt' : 'lt';
      const value = payload.values[depth];

      // A null sort value cannot be compared with gt/lt in a way that matches
      // Postgres NULLS ordering, so the id tiebreaker carries that page
      // boundary instead.
      clause[current.field] = value === null ? { not: null } : { [operator]: value };

      clauses.push(clause);
    }

    // Final tier: all sort fields equal, discriminate on id.
    const tiebreaker: Record<string, unknown> = {};
    sort.forEach((entry, index) => {
      tiebreaker[entry.field] = payload.values[index];
    });
    tiebreaker.id = {
      [(sort[0]?.direction ?? 'desc') === 'asc' ? 'gt' : 'lt']: payload.id,
    };
    clauses.push(tiebreaker);

    return { OR: clauses };
  }

  /**
   * Trims an over-fetched page and reports whether more exist.
   *
   * Repositories fetch `limit + 1` rows: if the extra one arrives, there is
   * another page. That avoids a separate `count()`, which on a cursor page is
   * wasted work — the caller only needs to know whether a "load more" button
   * should render.
   */
  paginate<T extends Record<string, unknown>>(
    rows: T[],
    limit: number,
    sort: SortField[],
  ): { data: T[]; nextCursor: string | null; hasMore: boolean } {
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);

    return {
      data,
      hasMore,
      nextCursor: hasMore && last ? this.encode(last, sort) : null,
    };
  }

  /** Dates become ISO strings so the cursor is JSON-safe and comparable. */
  private normalise(value: unknown): string | number | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number' || typeof value === 'string') return value;
    if (typeof value === 'boolean' || typeof value === 'bigint') return String(value);

    // Anything else is not a sortable scalar. Encoding '[object Object]' would
    // produce a cursor that compares against nothing and silently paginates
    // wrongly, so the tuple slot is nulled and the id tiebreaker carries the
    // boundary instead.
    return null;
  }
}
