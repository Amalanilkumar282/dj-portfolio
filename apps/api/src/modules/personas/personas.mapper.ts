import type { PersonaAdminDetail, PersonaDetail, PersonaSummary } from '@dj/contracts';

import { toMediaImage } from '../../common/base';

/**
 * Persona mappers.
 *
 * Two shapes on purpose: `toSummary` is what a card in a list needs, and
 * `toDetail` adds the bio, relations and SEO. Returning the detail shape
 * everywhere would ship a full markdown bio for every card on the home page.
 *
 * Pure functions with no injected dependencies, so they are trivially
 * testable and cannot accidentally issue a query.
 */

/** Loosely typed to avoid depending on generated per-query Prisma types. */
interface PersonaRow {
  id: string;
  key: string;
  slug: string;
  stageName: string;
  subtitle: string | null;
  shortDescription: string | null;
  primaryGenreLabel: string | null;
  accentColor: string;
  accentColorSecondary: string | null;
  gradientCss: string | null;
  isFeatured: boolean;
  isDuo: boolean;
  sortIndex: number;
  heroMedia?: Parameters<typeof toMediaImage>[0];
  avatarMedia?: Parameters<typeof toMediaImage>[0];
  bgVideoMedia?: { secureUrl: string } | null;
  heroMediaId?: string | null;
  avatarMediaId?: string | null;
  bgVideoMediaId?: string | null;
  tagline?: string | null;
  bio?: string;
  bioShort?: string | null;
  memberNames?: string[];
  homeCity?: string | null;
  country?: string | null;
  bpmRangeLow?: number | null;
  bpmRangeHigh?: number | null;
  yearsActiveFrom?: number | null;
  genres?: { isPrimary: boolean; genre: { slug: string; name: string } }[];
  socialLinks?: {
    platform: string;
    url: string;
    handle: string | null;
    followerCount: number | null;
    isPrimary: boolean;
  }[];
  status?: string;
  publishedAt?: Date | null;
  scheduledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  seoMeta?: {
    title: string | null;
    description: string | null;
    keywords: string[];
    canonicalUrl: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    noIndex: boolean;
    noFollow: boolean;
  } | null;
}

export function toPersonaSummary(row: PersonaRow): PersonaSummary {
  return {
    id: row.id,
    key: row.key as PersonaSummary['key'],
    slug: row.slug,
    stageName: row.stageName,
    subtitle: row.subtitle,
    shortDescription: row.shortDescription,
    primaryGenreLabel: row.primaryGenreLabel,
    accentColor: row.accentColor,
    accentColorSecondary: row.accentColorSecondary,
    gradientCss: row.gradientCss,
    isFeatured: row.isFeatured,
    isDuo: row.isDuo,
    heroImage: toMediaImage(row.heroMedia),
    sortIndex: row.sortIndex,
  };
}

export function toPersonaDetail(row: PersonaRow): PersonaDetail {
  return {
    ...toPersonaSummary(row),
    tagline: row.tagline ?? null,
    bio: row.bio ?? '',
    bioShort: row.bioShort ?? null,
    memberNames: row.memberNames ?? [],
    homeCity: row.homeCity ?? null,
    country: row.country ?? null,
    bpmRangeLow: row.bpmRangeLow ?? null,
    bpmRangeHigh: row.bpmRangeHigh ?? null,
    yearsActiveFrom: row.yearsActiveFrom ?? null,
    avatarImage: toMediaImage(row.avatarMedia),
    bgVideoUrl: row.bgVideoMedia?.secureUrl ?? null,
    genres: (row.genres ?? []).map((link) => ({
      slug: link.genre.slug,
      name: link.genre.name,
      isPrimary: link.isPrimary,
    })),
    socialLinks: row.socialLinks ?? [],
    seo: row.seoMeta
      ? {
          title: row.seoMeta.title,
          description: row.seoMeta.description,
          keywords: row.seoMeta.keywords,
          canonicalUrl: row.seoMeta.canonicalUrl,
          ogTitle: row.seoMeta.ogTitle,
          ogDescription: row.seoMeta.ogDescription,
          noIndex: row.seoMeta.noIndex,
          noFollow: row.seoMeta.noFollow,
        }
      : null,
  };
}

/**
 * The admin shape: everything in the public detail, plus the workflow fields.
 *
 * Kept separate from `toPersonaDetail` so a public response cannot
 * accidentally disclose that a draft exists, or when something is scheduled.
 */
export function toPersonaAdminDetail(row: PersonaRow): PersonaAdminDetail {
  return {
    ...toPersonaDetail(row),
    status: (row.status ?? 'DRAFT') as PersonaAdminDetail['status'],
    publishedAt: row.publishedAt ?? null,
    scheduledAt: row.scheduledAt ?? null,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt ?? new Date(0),
    updatedAt: row.updatedAt ?? new Date(0),
    heroMediaId: row.heroMediaId ?? null,
    avatarMediaId: row.avatarMediaId ?? null,
    bgVideoMediaId: row.bgVideoMediaId ?? null,
  };
}
