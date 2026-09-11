import type { SeoMeta } from '@dj/contracts';

/** The SeoMeta columns any mapper reads. */
export interface SeoRow {
  title: string | null;
  description: string | null;
  keywords: string[];
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  noIndex: boolean;
  noFollow: boolean;
}

/** Prisma `select` for SEO metadata. One definition, so nothing over-fetches. */
export const SEO_SELECT = {
  title: true,
  description: true,
  keywords: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  noIndex: true,
  noFollow: true,
} as const;

/**
 * Maps SEO metadata, or null when the entity has none.
 *
 * Null is the normal state rather than an error: `generateMetadata` on the web
 * side computes sensible fallbacks from the content itself, so an editor only
 * fills these in to override. See docs/02-architecture/seo.md.
 */
export function toSeoMeta(row: SeoRow | null | undefined): SeoMeta | null {
  if (!row) return null;

  return {
    title: row.title,
    description: row.description,
    keywords: row.keywords,
    canonicalUrl: row.canonicalUrl,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    noIndex: row.noIndex,
    noFollow: row.noFollow,
  };
}
