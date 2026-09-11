import type { VenueDetail, VenueSummary } from '@dj/contracts';

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

export function toVenueSummary(row: VenueRow): VenueSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    // Coordinates drive the gig map and the Place structured data. Seeded
    // approximately, so they are correctable in admin.
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
