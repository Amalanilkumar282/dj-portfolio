import type { Metadata } from 'next';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getGear } from '../../../server/queries/gear';

export const metadata: Metadata = {
  title: 'Setup & gear',
  description: 'The console, production and monitoring setup behind every DJ Felicitous show.',
  alternates: { canonical: absoluteUrl('/setup') },
};

const CATEGORY_LABELS: Record<string, string> = {
  MIXER: 'Mixers',
  CDJ: 'Players',
  CONTROLLER: 'Controllers',
  TURNTABLE: 'Turntables',
  DAW: 'Production',
  MONITOR: 'Monitoring',
  SOFTWARE: 'Software',
  OUTBOARD: 'Outboard',
  MICROPHONE: 'Microphones',
  LIGHTING: 'Lighting',
};

export default async function SetupPage(): Promise<React.JSX.Element> {
  const gear = await getGear();
  const byCategory = new Map<string, typeof gear>();
  for (const item of gear) {
    byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  }

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Behind the decks" title="Setup & gear" />
        <div className="space-y-10">
          {[...byCategory.entries()].map(([category, items]) => (
            <div key={category}>
              <h2 className="font-display text-h4 text-fg-strong">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-md border border-border p-4">
                    <p className="text-fg-strong font-medium">
                      {item.brand} {item.model}
                    </p>
                    <p className="text-fg-muted mt-1 text-xs">
                      {item.proficiency.toLowerCase()}
                      {item.isPreferred ? ' · preferred' : ''}
                      {item.isRiderItem ? ' · on rider' : ''}
                    </p>
                    {item.notes ? <p className="text-fg-secondary mt-2 text-sm">{item.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {gear.length === 0 ? <p className="text-fg-muted">The setup page isn&apos;t published yet.</p> : null}
      </Container>
    </Section>
  );
}
