import Link from 'next/link';

import type { EventSummary } from '@dj/contracts';
import { buttonClass } from '@dj/ui/primitives';
import { resolveShowPhase, type ShowPhase } from '@dj/utils';

import { PosterRail, PosterRailItem } from './poster-rail';
import { ShowCard } from './show-card';
import { ShowSpotlight } from './show-spotlight';

/**
 * The shows section — one spotlight plus a rail per state.
 *
 * Rows are built here, on the server, from two lists the API already
 * returns (upcoming and past), rather than by issuing one request per row.
 * Five requests for what is at most a few dozen rows would be five round
 * trips and five cache entries to keep coherent; one pass over two lists is
 * cheaper and cannot produce a card that appears in two rows at once,
 * because `resolveShowPhase` returns exactly one phase per event.
 *
 * Every row is omitted entirely when empty. An "Upcoming shows" heading over
 * nothing is worse than no heading — it advertises that there is no work on.
 */

interface Row {
  key: string;
  title: string;
  events: EventSummary[];
}

export function ShowsAct({
  upcoming,
  past,
  live,
  now,
}: {
  upcoming: EventSummary[];
  past: EventSummary[];
  live: EventSummary[];
  now: Date;
}): React.JSX.Element | null {
  const phaseOf = (event: EventSummary): ShowPhase =>
    resolveShowPhase(
      {
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        eventStatus: event.eventStatus,
        onSaleFrom: event.onSaleFrom,
        earlyBirdUntil: event.earlyBirdUntil,
        ticketUrl: event.ticketUrl,
      },
      now,
    );

  // `live` is fetched separately because "upcoming" keys off the hourly
  // isPast cron and so lags reality by up to an hour. Deduped by id, since a
  // freshly started show can legitimately appear in both lists.
  const seen = new Set(live.map((event) => event.id));
  const futureEvents = upcoming.filter((event) => !seen.has(event.id));

  const byPhase = (phase: ShowPhase): EventSummary[] =>
    futureEvents.filter((event) => phaseOf(event) === phase);

  const earlyBird = byPhase('early-bird');
  const onSale = byPhase('on-sale');
  const announced = [...byPhase('announced'), ...byPhase('sold-out')];

  const rows: Row[] = [
    { key: 'live', title: 'Happening now', events: live },
    { key: 'early-bird', title: 'Early bird open', events: earlyBird },
    { key: 'on-sale', title: 'Tickets on sale', events: onSale },
    { key: 'announced', title: 'Announced', events: announced },
    { key: 'past', title: 'Recently played', events: past.slice(0, 12) },
  ].filter((row) => row.events.length > 0);

  if (rows.length === 0) return null;

  // The spotlight is the most urgent thing there is: on stage now, else the
  // next one in the diary, else the most recent one played. Taking it out of
  // its own rail would leave a gap in that row, so it deliberately appears
  // in both — large at the top, and again in context below.
  const spotlight = live[0] ?? futureEvents[0] ?? past[0];

  return (
    <div className="space-y-14">
      {spotlight ? <ShowSpotlight event={spotlight} now={now} /> : null}

      {rows.map((row) => (
        <section key={row.key} aria-labelledby={`shows-row-${row.key}`}>
          <h3
            id={`shows-row-${row.key}`}
            className="text-eyebrow text-fg-secondary mb-4 font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase"
          >
            {row.title}
          </h3>

          <PosterRail label={row.title}>
            {row.events.map((event) => (
              <PosterRailItem key={event.id}>
                <ShowCard event={event} now={now} />
              </PosterRailItem>
            ))}
          </PosterRail>
        </section>
      ))}

      <div>
        <Link href="/events" className={buttonClass({ variant: 'outline', size: 'md' })}>
          Browse every show
        </Link>
      </div>
    </div>
  );
}
