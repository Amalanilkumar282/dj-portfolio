import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getPrograms } from '../../../server/queries/programs';

export const metadata: Metadata = {
  title: 'Residencies & programs',
  description: 'Branded nights and recurring shows — Housefull Sunday, Clubbers Friday and more.',
  alternates: { canonical: absoluteUrl('/programs') },
};

export default async function ProgramsPage(): Promise<React.JSX.Element> {
  const programs = await getPrograms();

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Residencies" title="Programs" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={`/programs/${program.slug}`}
              className="rounded-md border border-border bg-surface p-5 hover:border-accent"
            >
              <p className="text-fg-strong font-semibold">{program.name}</p>
              {program.subtitle ? <p className="text-fg-muted mt-1 text-sm">{program.subtitle}</p> : null}
              {program.isOngoing ? (
                <p className="text-accent mt-3 text-xs font-semibold uppercase">Ongoing</p>
              ) : null}
            </Link>
          ))}
        </div>
        {programs.length === 0 ? <p className="text-fg-muted">No programs published yet.</p> : null}
      </Container>
    </Section>
  );
}
