/**
 * "What state is this show in?" — resolved in exactly one place.
 *
 * The homepage rail, the /events browse page, the event detail page and the
 * admin form all need to answer this, and if any two of them answered it
 * differently the site would contradict itself: a poster badged "Early bird"
 * next to a detail page charging full price is worse than no badge at all.
 *
 * Deliberately a pure function taking `now` as an argument:
 *   - there is a lint rule against a bare `new Date()`, and it is right —
 *     a hidden clock read makes every test non-deterministic;
 *   - the server renders with one `now` and can pass the same one to every
 *     card on the page, so a list cannot straddle a minute boundary and
 *     badge two identical events differently.
 */

export type ShowPhase =
  | 'cancelled'
  | 'postponed'
  | 'live'
  | 'past'
  | 'sold-out'
  | 'early-bird'
  | 'on-sale'
  | 'announced';

export interface EventPhaseInput {
  startsAt: Date;
  endsAt?: Date | null;
  /** The EventStatus enum: ANNOUNCED | CONFIRMED | SOLD_OUT | CANCELLED | POSTPONED | COMPLETED. */
  eventStatus: string;
  onSaleFrom?: Date | null;
  earlyBirdUntil?: Date | null;
  ticketUrl?: string | null;
}

/**
 * How long a show is assumed to run when no `endsAt` was given.
 *
 * A club night with no stated end time is still on at 2am, and treating it as
 * "past" the minute after it starts would drop it out of "Happening now" and
 * into the archive while the artist is literally still playing. Six hours is
 * the honest upper bound for a single booking; anything longer is a festival,
 * which will have a real `endsAt`.
 */
const ASSUMED_RUN_MS = 6 * 60 * 60 * 1000;

export function resolveShowPhase(event: EventPhaseInput, now: Date): ShowPhase {
  // An abandoned show is an abandoned show whatever the clock says — this has
  // to win over "live", or a cancelled event would badge itself as on right
  // now for the length of its slot.
  if (event.eventStatus === 'CANCELLED') return 'cancelled';
  if (event.eventStatus === 'POSTPONED') return 'postponed';

  const startsAt = event.startsAt.getTime();
  const endsAt = event.endsAt ? event.endsAt.getTime() : startsAt + ASSUMED_RUN_MS;
  const nowMs = now.getTime();

  if (nowMs >= startsAt && nowMs < endsAt) return 'live';
  if (nowMs >= endsAt || event.eventStatus === 'COMPLETED') return 'past';

  // Everything below here is a future show, so the ticketing state is what
  // there is left to say about it.
  if (event.eventStatus === 'SOLD_OUT') return 'sold-out';

  const onSale = event.onSaleFrom == null || event.onSaleFrom.getTime() <= nowMs;

  if (onSale && event.earlyBirdUntil != null && event.earlyBirdUntil.getTime() > nowMs) {
    return 'early-bird';
  }
  if (onSale && event.ticketUrl) return 'on-sale';

  return 'announced';
}

const LABELS: Record<ShowPhase, string> = {
  cancelled: 'Cancelled',
  postponed: 'Postponed',
  live: 'Happening now',
  past: 'Played',
  'sold-out': 'Sold out',
  'early-bird': 'Early bird',
  'on-sale': 'Tickets on sale',
  announced: 'Announced',
};

export function showPhaseLabel(phase: ShowPhase): string {
  return LABELS[phase];
}

/** Phases where a ticket link is worth showing. Cancelled shows must not sell. */
export function isTicketable(phase: ShowPhase): boolean {
  return phase === 'early-bird' || phase === 'on-sale' || phase === 'live';
}
