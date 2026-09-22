import Link from 'next/link';

import type { EventSummary } from '@dj/contracts';
import { cardClass, Chip } from '@dj/ui/primitives';
import { formatIstDate, resolveShowPhase, showPhaseLabel, type ShowPhase } from '@dj/utils';

import { CloudinaryImage } from '../cloudinary-image';

/**
 * One show, as a poster.
 *
 * The flyer is the point — a promoter recognises a night by its artwork long
 * before they read its name, which is why the sketch drew this section as a
 * grid of poster tiles rather than a list of dates.
 *
 * When there is no flyer the card renders a **typographic** poster on the
 * persona gradient instead of a stock photo or a grey placeholder. A generic
 * image would imply artwork that does not exist, which is the same class of
 * dishonesty as an invented venue (docs/07-content/brand.md); type set large
 * on a gradient reads as a deliberate design, and it is the only option that
 * is both attractive and true.
 */

const PHASE_TONE: Record<ShowPhase, 'accent' | 'solid' | 'muted'> = {
  live: 'solid',
  'early-bird': 'solid',
  'on-sale': 'accent',
  announced: 'muted',
  'sold-out': 'muted',
  cancelled: 'muted',
  postponed: 'muted',
  past: 'muted',
};

export function ShowCard({
  event,
  now,
}: {
  event: EventSummary;
  /**
   * Passed in rather than read here, so every card in a list is badged
   * against one instant. Read per-card, two identical shows either side of a
   * minute boundary could badge differently in the same row.
   */
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

  return (
    <Link
      href={`/events/${event.slug}`}
      className={cardClass({
        tone: 'raised',
        interactive: true,
        className: 'group flex h-full flex-col overflow-hidden',
      })}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        {event.flyer ? (
          <CloudinaryImage
            image={event.flyer}
            sizes="(min-width: 640px) 16rem, 15rem"
            fill
            className="object-cover"
          />
        ) : (
          <div
            className="flex h-full flex-col justify-end bg-(image:--gradient-persona) p-4"
            aria-hidden="true"
          >
            <p className="font-display text-h3 text-fg-strong line-clamp-4 break-words">
              {event.title}
            </p>
          </div>
        )}

        <div className="absolute top-3 left-3">
          <Chip tone={PHASE_TONE[phase]} size="sm">
            {phase === 'live' ? (
              <span className="bg-on-accent motion-ok:animate-[rhythm-pulse_var(--beat,1s)_ease-in-out_infinite] inline-block size-1.5 rounded-full" />
            ) : null}
            {showPhaseLabel(phase)}
          </Chip>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-accent font-mono text-xs uppercase">
          {formatIstDate(event.startsAt)}
        </p>
        <p className="font-display text-h4 text-fg-strong mt-2 line-clamp-2">{event.title}</p>
        {place ? <p className="text-fg-muted mt-auto pt-3 text-sm line-clamp-1">{place}</p> : null}
      </div>
    </Link>
  );
}
