import type { ServiceAdminDetail, ServiceDetail, ServiceSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, toSeoMeta, type MediaAssetRow, type SeoRow } from '../../common/base';

/** A Prisma Decimal, or a plain number once it has been serialised. */
type DecimalLike = { toNumber: () => number } | number | null;

function toNumber(value: DecimalLike | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string | null;
  durationHours: number | null;
  priceFrom: DecimalLike;
  priceTo: DecimalLike;
  currency: string;
  persona?: { slug: string } | null;
  image?: MediaAssetRow | null;
  isFeatured: boolean;
  description?: string | null;
  inclusions?: string[];
  exclusions?: string[];
  addons?: string[];
  seoMeta?: SeoRow | null;
}

interface ServiceAdminRow extends ServiceRow {
  description: string | null;
  inclusions: string[];
  exclusions: string[];
  addons: string[];
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toServiceSummary(row: ServiceRow): ServiceSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category as ServiceSummary['category'],
    summary: row.summary,
    durationHours: row.durationHours,
    priceFrom: toNumber(row.priceFrom),
    priceTo: toNumber(row.priceTo),
    currency: row.currency as ServiceSummary['currency'],
    personaSlug: row.persona?.slug ?? null,
    image: toMediaImage(row.image),
    isFeatured: row.isFeatured,
  };
}

export function toServiceDetail(row: ServiceAdminRow): ServiceDetail {
  return {
    ...toServiceSummary(row),
    description: row.description,
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    addons: row.addons,
    seo: toSeoMeta(row.seoMeta ?? null),
  };
}

export function toServiceAdminDetail(row: ServiceAdminRow): ServiceAdminDetail {
  return {
    ...toServiceDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
