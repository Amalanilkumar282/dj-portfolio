import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getVenues } from '../../../server/queries/venues';

export const metadata: Metadata = {
  title: 'Venues',
  description: 'Clubs, hotels and festival grounds DJ Felicitous has played across India.',
  alternates: { canonical: absoluteUrl('/venues') },
};

export default async function VenuesPage(): Promise<React.JSX.Element> {
  const venues = await getVenues();

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="On the road" title="Venues played" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/venues/${venue.slug}`}
              className="rounded-md border border-border bg-surface p-5 hover:border-accent"
            >
              <p className="text-fg-strong font-semibold">{venue.name}</p>
              <p className="text-fg-muted mt-1 text-sm">
                {venue.city}
                {venue.state ? `, ${venue.state}` : ''}
              </p>
              <p className="text-fg-muted mt-2 text-xs">{venue.eventCount} show(s)</p>
            </Link>
          ))}
        </div>
        {venues.length === 0 ? <p className="text-fg-muted">No venues published yet.</p> : null}
      </Container>
    </Section>
  );
}
