import type { Metadata } from 'next';
import Link from 'next/link';

import type { EventSummary } from '@dj/contracts';
import { chipClass } from '@dj/ui/primitives';
import { isoWithIstOffset, resolveShowPhase, type ShowPhase } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { PosterRail, PosterRailItem } from '../../../components/home/poster-rail';
import { ShowCard } from '../../../components/home/show-card';
import { ShowSpotlight } from '../../../components/home/show-spotlight';
import { JsonLd, type JsonLdNode } from '../../../lib/json-ld';
import { absoluteUrl } from '../../../lib/site';
import { getLiveEvents, getPastEvents, getUpcomingEvents } from '../../../server/queries/events';
import { getPrograms } from '../../../server/queries/programs';

/**
 * The shows catalogue — rows of poster art, the way a streaming service
 * presents a library.
 *
 * This replaced a plain text list of upcoming dates. The list was honest but
 * it wasted the one asset every gig already has: its flyer. A promoter
 * recognises a night by its artwork, and a wall of artwork communicates "this
 * person works constantly" in a way a column of dates never does.
 *
 * Filters are `searchParams`-driven and resolved on the server, so the page
 * works with JavaScript disabled, each filtered view is its own crawlable
 * URL, and there is no client-side state to desynchronise from the URL.
 */

export const metadata: Metadata = {
  title: 'Shows',
  description:
    'Every show — announced, on sale and recently played. Club nights, festivals, weddings and corporate events.',
  alternates: { canonical: absoluteUrl('/events') },
};

interface SearchParams {
  city?: string;
  kind?: string;
  program?: string;
}

const KIND_LABELS: Record<string, string> = {
  CLUB: 'Club',
  FESTIVAL: 'Festival',
  WEDDING: 'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE: 'Private',
  RADIO: 'Radio',
  LIVESTREAM: 'Livestream',
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const filters = await searchParams;

  // One clock read for the whole page, so every badge on it agrees.
  const now = new Date();

  const [live, upcoming, past, programs] = await Promise.all([
    getLiveEvents(),
    getUpcomingEvents({ limit: 100 }),
    getPastEvents({ limit: 100 }),
    getPrograms(),
  ]);

  // Deduped: a show that has just started legitimately appears in both the
  // live list and the upcoming one, because `isPast` only flips hourly.
  const liveIds = new Set(live.map((event) => event.id));
  const all = [...live, ...upcoming.filter((event) => !liveIds.has(event.id)), ...past];

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

  // Facets are computed from the unfiltered set so the filter bar keeps
  // offering every option — a bar that empties itself as you use it strands
  // the visitor with no way back but the browser button.
  const cities = [...new Set(all.map((event) => event.city).filter(Boolean))].sort() as string[];
  const kinds = [...new Set(all.map((event) => event.kind))].sort();

  const matches = (event: EventSummary): boolean =>
    (!filters.city || event.city === filters.city) && (!filters.kind || event.kind === filters.kind);

  const visible = all.filter(matches);

  const phaseRows: { key: string; title: string; events: EventSummary[] }[] = [
    { key: 'live', title: 'Happening now', events: visible.filter((e) => phaseOf(e) === 'live') },
    {
      key: 'early-bird',
      title: 'Early bird open',
      events: visible.filter((e) => phaseOf(e) === 'early-bird'),
    },
    {
      key: 'on-sale',
      title: 'Tickets on sale',
      events: visible.filter((e) => phaseOf(e) === 'on-sale'),
    },
    {
      key: 'announced',
      title: 'Announced',
      events: visible.filter((e) => ['announced', 'sold-out'].includes(phaseOf(e))),
    },
    {
      key: 'past',
      title: 'Recently played',
      events: visible.filter((e) => phaseOf(e) === 'past'),
    },
  ].filter((row) => row.events.length > 0);

  // A row per recurring night — the artist's programmes are how regulars
  // think about these ("Bolly-Tech", "Clubbers Friday"), not by date.
  const programRows = programs
    .map((program) => ({
      key: `program:${program.slug}`,
      title: program.name,
      events: visible.filter((event) => event.venueSlug === program.venueSlug),
    }))
    .filter((row) => row.events.length > 1);

  const spotlight = live[0] ?? visible.find((event) => phaseOf(event) !== 'past');

  const graph: JsonLdNode[] = [
    {
      '@type': 'ItemList',
      name: 'Shows',
      itemListElement: [...live, ...upcoming].slice(0, 20).map((event, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'MusicEvent',
          name: event.title,
          url: absoluteUrl(`/events/${event.slug}`),
          startDate: isoWithIstOffset(event.startsAt),
          ...(event.endsAt ? { endDate: isoWithIstOffset(event.endsAt) } : {}),
          ...(event.venueName
            ? { location: { '@type': 'Place', name: event.venueName } }
            : {}),
        },
      })),
    },
  ];

  const hasFilter = Boolean(filters.city ?? filters.kind);

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader
          as="h1"
          eyebrow="Shows"
          title="Where the nights happen"
          description="Everything announced, on sale and recently played."
        />

        {all.length === 0 ? (
          // Honest empty state. No sample cards, no "coming soon" filler.
          <p className="text-fg-muted">No shows have been published yet.</p>
        ) : (
          <>
            {cities.length > 1 || kinds.length > 1 ? (
              <div className="mb-12 space-y-4">
                {kinds.length > 1 ? (
                  <FilterRow
                    label="Kind"
                    options={kinds.map((kind) => ({
                      value: kind,
                      label: KIND_LABELS[kind] ?? kind,
                    }))}
                    active={filters.kind}
                    paramName="kind"
                    current={filters}
                  />
                ) : null}

                {cities.length > 1 ? (
                  <FilterRow
                    label="City"
                    options={cities.map((city) => ({ value: city, label: city }))}
                    active={filters.city}
                    paramName="city"
                    current={filters}
                  />
                ) : null}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <div className="text-fg-muted">
                <p>No shows match that filter.</p>
                <Link href="/events" className="text-accent mt-3 inline-block underline">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="space-y-16">
                {spotlight && !hasFilter ? <ShowSpotlight event={spotlight} now={now} /> : null}

                {[...phaseRows, ...programRows].map((row) => (
                  <section key={row.key} aria-labelledby={`row-${row.key}`}>
                    <h2
                      id={`row-${row.key}`}
                      className="text-eyebrow text-fg-secondary mb-4 font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase"
                    >
                      {row.title}
                    </h2>
                    <PosterRail label={row.title}>
                      {row.events.map((event) => (
                        <PosterRailItem key={`${row.key}:${event.id}`}>
                          <ShowCard event={event} now={now} />
                        </PosterRailItem>
                      ))}
                    </PosterRail>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        <Link href="/events/archive" className="text-accent mt-16 inline-block text-sm underline">
          Full past-shows archive →
        </Link>
      </Container>

      <JsonLd graph={graph} />
    </Section>
  );
}

/**
 * One row of filter chips, each a real link.
 *
 * Links rather than buttons on purpose: every filtered view gets its own URL
 * that can be shared, bookmarked and crawled, and the page keeps working
 * without JavaScript. A client-side filter would have none of those.
 */
function FilterRow({
  label,
  options,
  active,
  paramName,
  current,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string | undefined;
  paramName: 'city' | 'kind';
  current: SearchParams;
}): React.JSX.Element {
  function hrefFor(value: string | null): string {
    // Built from the existing filters so the two rows compose rather than
    // resetting each other.
    const next = new URLSearchParams();
    for (const [key, existing] of Object.entries(current) as [string, string | undefined][]) {
      if (existing && key !== paramName) next.set(key, existing);
    }
    if (value) next.set(paramName, value);
    const query = next.toString();
    return query ? `/events?${query}` : '/events';
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-fg-muted mr-1 font-mono text-xs uppercase">{label}</span>

      <Link
        href={hrefFor(null)}
        className={chipClass({
          tone: active ? 'muted' : 'solid',
          size: 'md',
          interactive: Boolean(active),
        })}
      >
        All
      </Link>

      {options.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          className={chipClass({
            tone: active === option.value ? 'solid' : 'muted',
            size: 'md',
            interactive: active !== option.value,
          })}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
