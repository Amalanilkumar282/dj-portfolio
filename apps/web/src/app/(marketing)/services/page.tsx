import type { Metadata } from 'next';
import Link from 'next/link';

import { formatPriceRange } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getServices } from '../../../server/queries/services';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Weddings, corporate events, clubs, festivals and production — booking packages by DJ Felicitous.',
  alternates: { canonical: absoluteUrl('/services') },
};

export default async function ServicesPage(): Promise<React.JSX.Element> {
  const services = await getServices();

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Book DJ Felicitous" title="Services" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.slug}`}
              className="rounded-md border border-border bg-surface p-6 hover:border-accent"
            >
              <p className="text-fg-strong font-semibold">{service.name}</p>
              {service.summary ? <p className="text-fg-muted mt-2 text-sm">{service.summary}</p> : null}
              <p className="text-accent mt-4 text-sm font-semibold">
                {formatPriceRange(service.priceFrom, service.priceTo, service.currency)}
              </p>
            </Link>
          ))}
        </div>
        {services.length === 0 ? <p className="text-fg-muted">No services published yet.</p> : null}
      </Container>
    </Section>
  );
}
