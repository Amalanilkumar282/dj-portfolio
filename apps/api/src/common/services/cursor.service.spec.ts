import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CursorService, type SortField } from './cursor.service';

/**
 * Cursor pagination.
 *
 * The behaviour under test is stability: a cursor must not skip or repeat rows
 * when the sort column has ties, which is the failure a bare-id cursor
 * produces and the reason this carries the whole sort tuple.
 */

const service = new CursorService();

const byStartsAt: SortField[] = [{ field: 'startsAt', direction: 'desc' }];
const byMulti: SortField[] = [
  { field: 'sortIndex', direction: 'asc' },
  { field: 'releaseDate', direction: 'desc' },
];

describe('encode / decode', () => {
  it('round-trips the sort tuple and the id', () => {
    const row = { id: 'abc123', startsAt: new Date('2026-03-14T18:30:00Z') };

    const decoded = service.decode(service.encode(row, byStartsAt));

    expect(decoded.id).toBe('abc123');
    expect(decoded.values).toEqual(['2026-03-14T18:30:00.000Z']);
  });

  it('carries every sort field, not just the first', () => {
    // This is the whole point: a bare-id cursor cannot disambiguate ties.
    const row = { id: 'x', sortIndex: 3, releaseDate: new Date('2024-01-01T00:00:00Z') };

    const decoded = service.decode(service.encode(row, byMulti));

    expect(decoded.values).toEqual([3, '2024-01-01T00:00:00.000Z']);
  });

  it('normalises a null sort value rather than dropping it', () => {
    // Dropping it would shift every later value by one position and produce a
    // silently wrong keyset predicate.
    const row = { id: 'x', sortIndex: 1, releaseDate: null };

    expect(service.decode(service.encode(row, byMulti)).values).toEqual([1, null]);
  });

  it('is opaque to the client', () => {
    const encoded = service.encode({ id: 'abc', startsAt: new Date(0) }, byStartsAt);

    // base64url, so it is URL-safe without escaping.
    expect(encoded).not.toContain('{');
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('rejects a tampered cursor as a client error, not a 500', () => {
    expect(() => service.decode('not-a-cursor')).toThrow(BadRequestException);
    expect(() => service.decode(Buffer.from('{}').toString('base64url'))).toThrow(
      BadRequestException,
    );
  });
});

describe('toOrderBy', () => {
  it('appends the id so the ordering is total', () => {
    // Without the trailing id, tied rows have an undefined relative order
    // that Postgres may vary between queries — and pagination drops rows.
    expect(service.toOrderBy(byStartsAt)).toEqual([{ startsAt: 'desc' }, { id: 'desc' }]);
  });

  it('matches the id direction to the primary sort', () => {
    expect(service.toOrderBy([{ field: 'sortIndex', direction: 'asc' }])).toEqual([
      { sortIndex: 'asc' },
      { id: 'asc' },
    ]);
  });
});

describe('toWhere', () => {
  it('builds a lexicographic keyset predicate', () => {
    const payload = { values: [3, '2024-01-01T00:00:00.000Z'], id: 'row9' };

    const where = service.toWhere(payload, byMulti) as { OR: Record<string, unknown>[] };

    // One clause per sort depth, plus the all-equal id tiebreaker.
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ sortIndex: { gt: 3 } });
    expect(where.OR[1]).toEqual({
      sortIndex: 3,
      releaseDate: { lt: '2024-01-01T00:00:00.000Z' },
    });
    expect(where.OR[2]).toEqual({
      sortIndex: 3,
      releaseDate: '2024-01-01T00:00:00.000Z',
      id: { gt: 'row9' },
    });
  });

  it('falls back to the id tiebreaker for a null sort value', () => {
    const payload = { values: [null], id: 'row1' };

    const where = service.toWhere(payload, [{ field: 'releaseDate', direction: 'desc' }]) as {
      OR: Record<string, unknown>[];
    };

    // gt/lt against null cannot express Postgres NULLS ordering, so the page
    // boundary is carried by the id instead.
    expect(where.OR[0]).toEqual({ releaseDate: { not: null } });
    expect(where.OR[1]).toEqual({ releaseDate: null, id: { lt: 'row1' } });
  });
});

describe('paginate', () => {
  it('trims the over-fetched row and reports more pages', () => {
    // Repositories fetch limit + 1, so `hasMore` needs no separate count().
    const rows = Array.from({ length: 4 }, (_, i) => ({
      id: `r${String(i)}`,
      startsAt: new Date(2026, 0, i + 1),
    }));

    const page = service.paginate(rows, 3, byStartsAt);

    expect(page.data).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
    // The cursor points at the last RETURNED row, not the extra one.
    expect(service.decode(page.nextCursor!).id).toBe('r2');
  });

  it('reports no more pages when the extra row is absent', () => {
    const rows = [{ id: 'r0', startsAt: new Date(0) }];

    const page = service.paginate(rows, 3, byStartsAt);

    expect(page.data).toHaveLength(1);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('handles an empty page', () => {
    const page = service.paginate([], 20, byStartsAt);

    expect(page.data).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});
