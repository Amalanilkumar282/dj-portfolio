import type { Metadata } from 'next';

import { formatIstDate } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../lib/json-ld';
import { absoluteUrl } from '../../../lib/site';
import { getExperience } from '../../../server/queries/experience';

export const metadata: Metadata = {
  title: 'About',
  description: 'The story behind DJ Felicitous and a timeline of residencies, labels and production credits.',
  alternates: { canonical: absoluteUrl('/about') },
};

export default async function AboutPage(): Promise<React.JSX.Element> {
  const experience = await getExperience();

  const graph: JsonLdNode[] = [
    {
      '@type': 'AboutPage',
      '@id': `${absoluteUrl('/about')}#page`,
      about: { '@type': 'Person', name: 'DJ Felicitous' },
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <SectionHeader eyebrow="Since day one" title="About" />
        <ol className="space-y-8 border-l border-border pl-6">
          {experience.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="bg-accent absolute -left-[29px] top-1.5 size-2.5 rounded-full" />
              <p className="text-fg-strong font-semibold">{entry.role}</p>
              <p className="text-fg-secondary text-sm">{entry.organisation}</p>
              <p className="text-fg-muted mt-1 text-xs">
                {formatIstDate(entry.startDate)}
                {entry.isCurrent ? ' — present' : entry.endDate ? ` – ${formatIstDate(entry.endDate)}` : ''}
                {entry.location ? ` · ${entry.location}` : ''}
              </p>
              {entry.summary ? <p className="text-fg-secondary mt-2 text-sm">{entry.summary}</p> : null}
              {entry.highlights.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-sm text-fg-secondary">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
        {experience.length === 0 ? <p className="text-fg-muted">The timeline isn&apos;t published yet.</p> : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
