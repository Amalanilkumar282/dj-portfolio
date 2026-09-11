import type { Metadata } from 'next';
import Link from 'next/link';

import { formatEventDateRange } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getUpcomingEvents } from '../../../server/queries/events';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming shows, weddings, corporate events and club nights.',
  alternates: { canonical: absoluteUrl('/events') },
};

export default async function EventsPage(): Promise<React.JSX.Element> {
  const events = await getUpcomingEvents();

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Live" title="Upcoming events" />
        {events.length === 0 ? (
          <p className="text-fg-muted">No upcoming events announced yet.</p>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
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
        )}
        <Link href="/events/archive" className="text-accent mt-8 inline-block text-sm underline">
          Past shows archive →
        </Link>
      </Container>
    </Section>
  );
}
