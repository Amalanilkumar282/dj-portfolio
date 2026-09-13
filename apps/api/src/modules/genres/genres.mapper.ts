import type { GenreAdminDetail, GenreDetail } from '@dj/contracts';

interface GenreRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  colorHex: string | null;
  sortIndex: number;
}

/** The admin row, which carries usage counts and timestamps. */
interface GenreAdminRow extends GenreRow {
  createdAt: Date;
  updatedAt: Date;
  _count?: { personas: number; tracks: number };
}

/**
 * Genres have no summary/detail split: the whole row is six scalar columns,
 * so a second shape would carry no less data.
 */
export function toGenreDetail(row: GenreRow): GenreDetail {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    colorHex: row.colorHex,
    sortIndex: row.sortIndex,
  };
}

/**
 * The admin shape.
 *
 * Counts default to 0 rather than being optional: a missing `_count` means
 * the repository forgot to select it, and rendering "0 tracks" next to a
 * delete button that will strip 40 tracks is worse than rendering nothing.
 * The repository always selects it; this keeps the type honest if it stops.
 */
export function toGenreAdminDetail(row: GenreAdminRow): GenreAdminDetail {
  return {
    ...toGenreDetail(row),
    personaCount: row._count?.personas ?? 0,
    trackCount: row._count?.tracks ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
