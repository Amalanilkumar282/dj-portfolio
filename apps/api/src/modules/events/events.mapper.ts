import type { EventDetail, EventSummary } from '@dj/contracts';

import { toMediaImage } from '../../common/base';
import { toSeoMeta, type SeoRow } from '../../common/base/seo.mapper';
import { toVenueSummary } from '../venues/venues.mapper';

/** A Prisma Decimal, or a plain number once it has been serialised. */
type DecimalLike = { toNumber: () => number } | number | null;

interface EventRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  eventStatus: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  isPast: boolean;
  isFeatured: boolean;
  isFree: boolean;
  ticketUrl: string | null;
  ticketPriceMin: DecimalLike;
  ticketPriceMax: DecimalLike;
  currency: string;
  ageRestriction: string | null;
  venueNameOverride: string | null;
  cityOverride: string | null;
  flyer?: Parameters<typeof toMediaImage>[0];
  persona?: { slug: string } | null;
  venue?: Parameters<typeof toVenueSummary>[0] | null;
  program?: { slug: string } | null;
  description?: string | null;
  doorsOpenAt?: Date | null;
  attendanceEstimate?: number | null;
  lineup?: {
    artistName: string;
    role: string | null;
    isHeadliner: boolean;
    persona?: { slug: string } | null;
  }[];
  seoMeta?: SeoRow | null;
}

/**
 * Converts a money column to a number.
 *
 * Decimal columns come back as Prisma `Decimal`, which JSON-serialises to a
 * string — so a client doing arithmetic on the raw response would silently
 * concatenate rather than add.
 */
function toNumber(value: DecimalLike | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

export function toEventSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    kind: row.kind as EventSummary['kind'],
    eventStatus: row.eventStatus as EventSummary['eventStatus'],
    // Stored and returned as UTC. The web app renders IST and emits an
    // explicit +05:30 offset in JSON-LD — a bare Z makes Google display
    // Indian gigs at the wrong local time in rich results.
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    isPast: row.isPast,
    isFeatured: row.isFeatured,
    isFree: row.isFree,
    ticketUrl: row.ticketUrl,
    ticketPriceMin: toNumber(row.ticketPriceMin),
    ticketPriceMax: toNumber(row.ticketPriceMax),
    currency: row.currency as EventSummary['currency'],
    ageRestriction: row.ageRestriction,
    // A linked Venue wins over the one-off override, which exists only for
    // venues not worth a row of their own.
    venueName: row.venue?.name ?? row.venueNameOverride,
    venueSlug: row.venue?.slug ?? null,
    city: row.venue?.city ?? row.cityOverride,
    personaSlug: row.persona?.slug ?? null,
    flyer: toMediaImage(row.flyer),
  };
}

export function toEventDetail(row: EventRow): EventDetail {
  return {
    ...toEventSummary(row),
    description: row.description ?? null,
    doorsOpenAt: row.doorsOpenAt ?? null,
    attendanceEstimate: row.attendanceEstimate ?? null,
    venue: row.venue ? toVenueSummary(row.venue) : null,
    lineup: (row.lineup ?? []).map((slot) => ({
      artistName: slot.artistName,
      role: slot.role,
      isHeadliner: slot.isHeadliner,
      // Null for a guest artist, who has no Persona row.
      personaSlug: slot.persona?.slug ?? null,
    })),
    programSlug: row.program?.slug ?? null,
    seo: toSeoMeta(row.seoMeta),
  };
}
