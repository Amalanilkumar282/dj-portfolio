import Link from 'next/link';

import type { EventSummary } from '@dj/contracts';
import { buttonClass, Chip } from '@dj/ui/primitives';
import {
  formatIstDateTime,
  formatPriceRange,
  isTicketable,
  resolveShowPhase,
  showPhaseLabel,
} from '@dj/utils';

import { CloudinaryImage } from '../cloudinary-image';

/**
 * The one show given the full width — whatever a visitor should see first.
 *
 * A promoter landing on the homepage is asking one question: "is this person
 * working right now?" A single, large, current show answers it in a glance
 * far better than a row of thumbnails does, which is why this sits above the
 * rails rather than beside them.
 *
 * Server-rendered in full. The only client island is the countdown, and the
 * page is complete and correct without it.
 */
export function ShowSpotlight({
  event,
  now,
}: {
  event: EventSummary;
  now: Date;
}): React.JSX.Element {
  const phase = resolveShowPhase(
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

  const place = [event.venueName, event.city].filter(Boolean).join(' · ');

  // Early-bird price when the window is open, standard price otherwise —
  // quoting the discounted figure after it expires would be a false price,
  // which brand.md rules out as firmly as an invented venue.
  const priceMax =
    phase === 'early-bird' && event.earlyBirdPriceMax !== null
      ? event.earlyBirdPriceMax
      : event.ticketPriceMax;

  return (
    <div className="border-border bg-surface/40 grid overflow-hidden rounded-lg border lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[22rem]">
        {event.flyer ? (
          <CloudinaryImage
            image={event.flyer}
            sizes="(min-width: 1024px) 40vw, 100vw"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-(image:--gradient-persona)" aria-hidden="true" />
        )}
      </div>

      {/* min-w-0: without it this grid column takes its content's min-content
          width, and a long unbroken title widens the whole card past the
          viewport on mobile. */}
      <div className="flex min-w-0 flex-col justify-center p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone={phase === 'live' ? 'solid' : 'accent'} size="md">
            {phase === 'live' ? (
              <span className="bg-on-accent motion-ok:animate-[rhythm-pulse_var(--beat,1s)_ease-in-out_infinite] inline-block size-1.5 rounded-full" />
            ) : null}
            {showPhaseLabel(phase)}
          </Chip>
          {event.ageRestriction ? <Chip size="md">{event.ageRestriction}</Chip> : null}
        </div>

        <h3 className="font-display text-h2 text-fg-strong mt-5 break-words">{event.title}</h3>
        {event.subtitle ? (
          <p className="text-fg-secondary mt-2 text-sm">{event.subtitle}</p>
        ) : null}

        <dl className="text-fg-secondary mt-6 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="sr-only">When</dt>
            {/* IST, always — the audience and the artist are both in India. */}
            <dd>{formatIstDateTime(event.startsAt, event.timezone)}</dd>
          </div>
          {place ? (
            <div className="flex gap-2">
              <dt className="sr-only">Where</dt>
              <dd>{place}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="sr-only">Entry</dt>
            <dd>
              {event.isFree
                ? 'Free entry'
                : formatPriceRange(event.ticketPriceMin, priceMax, event.currency)}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={`/events/${event.slug}`}
            className={buttonClass({ variant: 'solid', size: 'md' })}
          >
            Show details
          </Link>
          {isTicketable(phase) && event.ticketUrl ? (
            <a
              href={event.ticketUrl}
              // Tickets are sold by a third party. noopener is the security
              // baseline; nofollow keeps a paid ticketing link from reading
              // as an endorsement to a crawler.
              rel="noopener noreferrer nofollow"
              target="_blank"
              className={buttonClass({ variant: 'outline', size: 'md' })}
            >
              Get tickets
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
