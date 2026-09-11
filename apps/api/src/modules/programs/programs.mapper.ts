import type { ProgramDetail, ProgramSummary } from '@dj/contracts';

import { toMediaImage } from '../../common/base';
import { toSeoMeta, type SeoRow } from '../../common/base/seo.mapper';

interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  cadence: string | null;
  isOngoing: boolean;
  hero?: Parameters<typeof toMediaImage>[0];
  persona?: { slug: string } | null;
  venue?: { name: string; slug: string } | null;
  _count?: { events: number };
  description?: string | null;
  residencyFrom?: Date | null;
  residencyTo?: Date | null;
  seoMeta?: SeoRow | null;
}

export function toProgramSummary(row: ProgramRow): ProgramSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    cadence: row.cadence,
    isOngoing: row.isOngoing,
    personaSlug: row.persona?.slug ?? null,
    venueName: row.venue?.name ?? null,
    venueSlug: row.venue?.slug ?? null,
    hero: toMediaImage(row.hero),
    eventCount: row._count?.events ?? 0,
  };
}

export function toProgramDetail(row: ProgramRow): ProgramDetail {
  return {
    ...toProgramSummary(row),
    description: row.description ?? null,
    residencyFrom: row.residencyFrom ?? null,
    residencyTo: row.residencyTo ?? null,
    seo: toSeoMeta(row.seoMeta),
  };
}
