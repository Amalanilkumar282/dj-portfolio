import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getRiderGear } from '../../../server/queries/gear';

export const metadata: Metadata = {
  title: 'Technical rider',
  description: 'The equipment DJ Felicitous needs a venue to provide.',
  alternates: { canonical: absoluteUrl('/rider') },
};

export default async function RiderPage(): Promise<React.JSX.Element> {
  const gear = await getRiderGear();

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <SectionHeader eyebrow="For venues & production" title="Technical rider" />
        <p className="text-fg-secondary">
          The minimum stage setup for a DJ Felicitous show. For a full PDF rider, see the{' '}
          <Link href="/press" className="text-accent underline">
            press kit
          </Link>
          .
        </p>
        <ul className="mt-8 space-y-3">
          {gear.map((item) => (
            <li key={item.id} className="rounded-md border border-border p-4">
              <p className="text-fg-strong font-medium">
                {item.brand} {item.model}
              </p>
              {item.notes ? <p className="text-fg-secondary mt-1 text-sm">{item.notes}</p> : null}
              {item.isPreferred ? <p className="text-accent mt-1 text-xs">Preferred</p> : null}
            </li>
          ))}
        </ul>
        {gear.length === 0 ? <p className="text-fg-muted">The rider isn&apos;t published yet.</p> : null}
      </Container>
    </Section>
  );
}
