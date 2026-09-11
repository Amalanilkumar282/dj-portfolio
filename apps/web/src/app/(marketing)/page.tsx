import type { Metadata } from 'next';
import Link from 'next/link';

import { formatEventDateRange } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../components/container';
import { JsonLd, type JsonLdNode } from '../../lib/json-ld';
import { absoluteUrl, personaThemeName, SITE } from '../../lib/site';
import { getUpcomingEvents } from '../../server/queries/events';
import { getPersonas } from '../../server/queries/personas';
import { getSettings } from '../../server/queries/settings';
import { getStats } from '../../server/queries/stats';
import { getTestimonials } from '../../server/queries/testimonials';
import { getFeaturedTracks } from '../../server/queries/tracks';

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
  openGraph: { url: absoluteUrl('/'), type: 'website' },
};

export default async function HomePage(): Promise<React.JSX.Element> {
  const [personas, upcomingEvents, featuredTracks, stats, testimonials, settings] = await Promise.all([
    getPersonas(),
    getUpcomingEvents({ limit: 3 }),
    getFeaturedTracks(),
    getStats(),
    getTestimonials({ limit: 3 }),
    getSettings(),
  ]);

  const graph: JsonLdNode[] = [
    {
      '@type': 'Person',
      '@id': `${absoluteUrl('/')}#person`,
      name: 'DJ Felicitous',
      url: absoluteUrl('/'),
      jobTitle: 'DJ & Producer',
    },
    {
      '@type': 'EntertainmentBusiness',
      '@id': `${absoluteUrl('/')}#business`,
      name: settings.siteName,
      telephone: settings.contactPhone ?? undefined,
      email: settings.contactEmail,
      areaServed: ['Bengaluru', 'Karnataka', 'India'],
      address: settings.addressCity
        ? {
            '@type': 'PostalAddress',
            addressLocality: settings.addressCity,
            addressRegion: settings.addressRegion ?? undefined,
            addressCountry: settings.addressCountry ?? 'IN',
          }
        : undefined,
      geo:
        settings.latitude != null && settings.longitude != null
          ? { '@type': 'GeoCoordinates', latitude: settings.latitude, longitude: settings.longitude }
          : undefined,
    },
    {
      '@type': 'ItemList',
      name: 'Personas',
      itemListElement: personas.map((persona, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(`/${persona.slug}`),
        name: persona.stageName,
      })),
    },
  ];

  return (
    <>
      <Section className="pt-24">
        <Container>
          <p className="text-eyebrow text-accent font-semibold uppercase">Bengaluru · India</p>
          <h1 className="font-display text-display text-fg-strong mt-4 max-w-4xl">DJ Felicitous</h1>
          <p className="text-lead text-fg-secondary mt-6 max-w-xl">{SITE.defaultDescription}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/book"
              className="bg-accent text-on-accent rounded-full px-6 py-3 text-sm font-semibold"
            >
              Book an event
            </Link>
            <Link
              href="/music"
              className="border-border text-fg-strong rounded-full border px-6 py-3 text-sm font-semibold"
            >
              Listen to the music
            </Link>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Four acts, one artist" title="Personas" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {personas.map((persona) => (
              <Link
                key={persona.id}
                href={`/${persona.slug}`}
                data-theme={personaThemeName(persona.key)}
                className="group rounded-lg border border-border bg-surface p-6 transition hover:border-accent"
              >
                <p className="font-display text-h4 text-fg-strong">{persona.stageName}</p>
                {persona.subtitle ? <p className="text-fg-muted mt-2 text-sm">{persona.subtitle}</p> : null}
                {persona.primaryGenreLabel ? (
                  <p className="text-accent mt-4 text-xs font-semibold uppercase">
                    {persona.primaryGenreLabel}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {stats.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.id} className="text-center">
                  <p className="font-display text-h2 text-accent">
                    {stat.value}
                    {stat.suffix ?? ''}
                  </p>
                  <p className="text-fg-muted mt-2 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader eyebrow="Live" title="Upcoming shows" />
            <ul className="space-y-4">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.slug}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-surface p-5 hover:border-accent"
                  >
                    <span className="text-fg-strong font-semibold">{event.title}</span>
                    <span className="text-fg-muted text-sm">
                      {formatEventDateRange(event.startsAt, event.endsAt)}
                      {event.city ? ` · ${event.city}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {featuredTracks.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeader eyebrow="Sound" title="Featured tracks" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTracks.map((track) => (
                <Link
                  key={track.id}
                  href={`/music/${track.slug}`}
                  className="rounded-md border border-border bg-bg p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{track.title}</p>
                  <p className="text-fg-muted mt-1 text-sm">{track.artistLabel}</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {testimonials.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader eyebrow="Word of mouth" title="What clients say" />
            <div className="grid gap-6 sm:grid-cols-3">
              {testimonials.map((testimonial) => (
                <blockquote key={testimonial.id} className="rounded-md border border-border p-6">
                  <p className="text-fg-secondary text-sm italic">&ldquo;{testimonial.quote}&rdquo;</p>
                  <footer className="text-fg-muted mt-4 text-xs">
                    {testimonial.authorName}
                    {testimonial.venueOrEvent ? ` — ${testimonial.venueOrEvent}` : ''}
                  </footer>
                </blockquote>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <JsonLd graph={graph} />
    </>
  );
}
