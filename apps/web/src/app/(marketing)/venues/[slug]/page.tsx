import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container, Section } from '../../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../../lib/json-ld';
import { absoluteUrl } from '../../../../lib/site';
import { getVenue } from '../../../../server/queries/venues';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) return {};
  return {
    title: `${venue.name}, ${venue.city}`,
    alternates: { canonical: absoluteUrl(`/venues/${slug}`) },
  };
}

export default async function VenuePage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const venue = await getVenue(slug);
  if (!venue) notFound();

  const url = absoluteUrl(`/venues/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'Place',
      '@id': `${url}#place`,
      name: venue.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: venue.addressLine ?? undefined,
        addressLocality: venue.city,
        addressRegion: venue.state ?? undefined,
        addressCountry: venue.country,
      },
      geo:
        venue.latitude != null && venue.longitude != null
          ? { '@type': 'GeoCoordinates', latitude: venue.latitude, longitude: venue.longitude }
          : undefined,
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <h1 className="font-display text-h1 text-fg-strong">{venue.name}</h1>
        <p className="text-fg-secondary mt-2">
          {venue.addressLine ? `${venue.addressLine}, ` : ''}
          {venue.city}
          {venue.state ? `, ${venue.state}` : ''}
        </p>
        {venue.capacity ? (
          <p className="text-fg-muted mt-1 text-sm">Capacity: {venue.capacity.toLocaleString('en-IN')}</p>
        ) : null}
        {venue.notes ? <p className="text-fg-secondary mt-6 whitespace-pre-line">{venue.notes}</p> : null}
        <p className="text-fg-muted mt-6 text-sm">
          {venue.eventCount} show{venue.eventCount === 1 ? '' : 's'} played here
        </p>
        {venue.websiteUrl ? (
          <a href={venue.websiteUrl} rel="noopener noreferrer" target="_blank" className="text-accent mt-2 inline-block text-sm underline">
            Venue website →
          </a>
        ) : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
