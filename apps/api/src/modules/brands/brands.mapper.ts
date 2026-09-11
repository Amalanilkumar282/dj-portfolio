import type { BrandAdminDetail, BrandSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface BrandRow {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  logo?: MediaAssetRow | null;
  logoMono?: MediaAssetRow | null;
  category: string | null;
  isFeatured: boolean;
  personas?: { persona: { slug: string } }[];
}

interface BrandAdminRow extends BrandRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toBrandSummary(row: BrandRow): BrandSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    websiteUrl: row.websiteUrl,
    logo: toMediaImage(row.logo),
    logoMono: toMediaImage(row.logoMono),
    category: row.category,
    isFeatured: row.isFeatured,
    personaSlugs: (row.personas ?? []).map((p) => p.persona.slug),
  };
}

export function toBrandAdminDetail(row: BrandAdminRow): BrandAdminDetail {
  return {
    ...toBrandSummary(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
