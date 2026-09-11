import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatEventDateRange, formatPriceRange, isoWithIstOffset } from '@dj/utils';

import { Container, Section } from '../../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../../lib/json-ld';
import { absoluteUrl } from '../../../../lib/site';
import { getEvent } from '../../../../server/queries/events';

interface Params {
  slug: string;
}

const EVENT_STATUS_MAP: Record<string, string> = {
  ANNOUNCED: 'https://schema.org/EventScheduled',
  CONFIRMED: 'https://schema.org/EventScheduled',
  SOLD_OUT: 'https://schema.org/EventScheduled',
  CANCELLED: 'https://schema.org/EventCancelled',
  POSTPONED: 'https://schema.org/EventPostponed',
  COMPLETED: 'https://schema.org/EventScheduled',
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return {};
  return {
    title: event.title,
    description: event.description ?? `${event.title} — ${event.kind.toLowerCase()} event`,
    alternates: { canonical: absoluteUrl(`/events/${slug}`) },
  };
}

export default async function EventPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const url = absoluteUrl(`/events/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'MusicEvent',
      '@id': `${url}#event`,
      name: event.title,
      startDate: isoWithIstOffset(event.startsAt),
      endDate: event.endsAt ? isoWithIstOffset(event.endsAt) : undefined,
      eventStatus: EVENT_STATUS_MAP[event.eventStatus],
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: event.venue
        ? {
            '@type': 'Place',
            name: event.venue.name,
            address: {
              '@type': 'PostalAddress',
              addressLocality: event.venue.city,
              addressCountry: event.venue.country,
            },
            geo:
              event.venue.latitude != null && event.venue.longitude != null
                ? { '@type': 'GeoCoordinates', latitude: event.venue.latitude, longitude: event.venue.longitude }
                : undefined,
          }
        : event.city
          ? { '@type': 'Place', name: event.city }
          : undefined,
      performer: { '@type': 'MusicGroup', name: event.personaSlug ?? 'DJ Felicitous' },
      offers: event.ticketUrl
        ? {
            '@type': 'Offer',
            url: event.ticketUrl,
            priceCurrency: event.currency,
            price: event.ticketPriceMin ?? undefined,
          }
        : undefined,
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <p className="text-eyebrow text-accent font-semibold uppercase">{event.kind}</p>
        <h1 className="font-display text-h1 text-fg-strong mt-4">{event.title}</h1>
        <p className="text-fg-secondary mt-4">{formatEventDateRange(event.startsAt, event.endsAt)}</p>
        {event.venue ? (
          <p className="text-fg-muted mt-1">
            <Link href={`/venues/${event.venue.slug}`} className="hover:text-accent underline">
              {event.venue.name}
            </Link>
            , {event.venue.city}
          </p>
        ) : event.city ? (
          <p className="text-fg-muted mt-1">{event.city}</p>
        ) : null}
        {event.ticketPriceMin != null ? (
          <p className="text-fg-muted mt-1 text-sm">
            {formatPriceRange(event.ticketPriceMin, event.ticketPriceMax, event.currency)}
          </p>
        ) : null}
        {event.description ? (
          <p className="text-fg-secondary mt-6 whitespace-pre-line">{event.description}</p>
        ) : null}
        {event.ticketUrl ? (
          <a
            href={event.ticketUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="bg-accent text-on-accent mt-8 inline-block rounded-full px-6 py-3 text-sm font-semibold"
          >
            Get tickets
          </a>
        ) : null}
        {event.lineup.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-display text-h4 text-fg-strong">Lineup</h2>
            <ul className="mt-3 space-y-1">
              {event.lineup.map((slot, index) => (
                <li key={`${slot.artistName}-${String(index)}`} className="text-fg-secondary text-sm">
                  {slot.artistName}
                  {slot.isHeadliner ? ' (headliner)' : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
