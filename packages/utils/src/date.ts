/**
 * Date and time handling.
 *
 * Every timestamp is stored UTC in Postgres. Every timestamp shown to a human
 * is rendered in IST, because the artist, the venues and virtually all
 * clients are in India. Keeping both facts in one module means no component
 * has to remember which it is holding.
 */

export const IST = 'Asia/Kolkata';

/** IST is UTC+05:30 year-round: India observes no daylight saving. */
const IST_OFFSET = '+05:30';

/**
 * Decomposes an instant into IST calendar parts.
 *
 * Uses `Intl` rather than arithmetic so the result stays correct if this ever
 * needs to serve another zone.
 */
export function toIstParts(date: Date, timeZone: string = IST): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
}

/** "Sat, 14 Mar 2026" */
export function formatIstDate(date: Date, timeZone: string = IST): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** "Sat, 14 Mar 2026, 10:00 pm" */
export function formatIstDateTime(date: Date, timeZone: string = IST): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Renders an event's date span for a listing card.
 *
 * Club sets routinely run past midnight, so an end time on the following
 * calendar day is normal and must not read as a two-day event.
 */
export function formatEventDateRange(
  startsAt: Date,
  endsAt: Date | null | undefined,
  timeZone: string = IST,
): string {
  const start = formatIstDateTime(startsAt, timeZone);
  if (!endsAt) return start;

  const sameDay =
    new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'short' }).format(startsAt) ===
    new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'short' }).format(endsAt);

  const endTime = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(endsAt);

  // A set ending within ~8 hours of the start is the same night, even if the
  // clock has rolled over midnight.
  const spansMidnightSameNight =
    !sameDay && endsAt.getTime() - startsAt.getTime() <= 8 * 60 * 60 * 1000;

  if (sameDay || spansMidnightSameNight) return `${start} – ${endTime}`;
  return `${start} – ${formatIstDateTime(endsAt, timeZone)}`;
}

/**
 * Emits an ISO-8601 string carrying an explicit IST offset.
 *
 * Schema.org `MusicEvent.startDate` must include an offset; a bare `Z` makes
 * Google display Indian gigs in the wrong local time in rich results.
 */
export function isoWithIstOffset(date: Date, timeZone: string = IST): string {
  const p = toIstParts(date, timeZone);
  const offset = timeZone === IST ? IST_OFFSET : 'Z';
  return `${p.year ?? ''}-${p.month ?? ''}-${p.day ?? ''}T${p.hour ?? '00'}:${
    p.minute ?? '00'
  }:00${offset}`;
}
