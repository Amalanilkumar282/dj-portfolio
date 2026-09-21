import type { VenueAdminDetail, VenueDetail, VenueSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toSeoMeta, type SeoRow } from '../../common/base/seo.mapper';

interface VenueRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  /** Supplied by the groupBy rollup on the persona page. */
  eventCount?: number;
  /** Supplied by an ordinary include. */
  _count?: { events: number };
  addressLine?: string | null;
  postalCode?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  notes?: string | null;
  seoMeta?: SeoRow | null;
}

/** The admin row, which carries the publish-workflow columns. */
interface VenueAdminRow extends VenueRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toVenueSummary(row: VenueRow): VenueSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    // Coordinates drive the Place structured data (JSON-LD `GeoCoordinates`)
    // on the venue's own page. Seeded approximately, so they are correctable
    // in admin.
    latitude: row.latitude,
    longitude: row.longitude,
    capacity: row.capacity,
    // Two shapes accepted: the venue-cloud rollup counts via groupBy, while a
    // plain list uses _count. Handling both keeps one mapper for both queries.
    eventCount: row.eventCount ?? row._count?.events ?? 0,
  };
}

export function toVenueDetail(row: VenueRow): VenueDetail {
  return {
    ...toVenueSummary(row),
    addressLine: row.addressLine ?? null,
    postalCode: row.postalCode ?? null,
    websiteUrl: row.websiteUrl ?? null,
    instagramUrl: row.instagramUrl ?? null,
    notes: row.notes ?? null,
    seo: toSeoMeta(row.seoMeta),
  };
}

/**
 * The admin shape. Kept separate from `toVenueDetail` so a public response
 * cannot accidentally disclose that a draft exists, or when something is
 * scheduled.
 */
export function toVenueAdminDetail(row: VenueAdminRow): VenueAdminDetail {
  return {
    ...toVenueDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
