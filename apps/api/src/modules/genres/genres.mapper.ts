import type { GenreDetail } from '@dj/contracts';

interface GenreRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  colorHex: string | null;
  sortIndex: number;
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
