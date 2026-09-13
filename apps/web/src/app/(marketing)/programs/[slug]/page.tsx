import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatIstDate } from '@dj/utils';

import { Container, Section } from '../../../../components/container';
import { absoluteUrl } from '../../../../lib/site';
import { getProgram } from '../../../../server/queries/programs';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) return {};
  return {
    title: program.name,
    description: program.description ?? program.subtitle ?? undefined,
    alternates: { canonical: absoluteUrl(`/programs/${slug}`) },
  };
}

export default async function ProgramPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) notFound();

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        {program.cadence ? (
          <p className="text-eyebrow text-accent font-semibold uppercase">{program.cadence}</p>
        ) : null}
        <h1 className="font-display text-h1 text-fg-strong mt-4">{program.name}</h1>
        {program.subtitle ? <p className="text-lead text-fg-secondary mt-4">{program.subtitle}</p> : null}
        {program.venueName ? (
          <p className="text-fg-muted mt-2">
            {program.venueSlug ? (
              <Link href={`/venues/${program.venueSlug}`} className="hover:text-accent underline">
                {program.venueName}
              </Link>
            ) : (
              program.venueName
            )}
          </p>
        ) : null}
        {program.residencyFrom ? (
          <p className="text-fg-muted mt-1 text-sm">
            Since {formatIstDate(program.residencyFrom)}
            {program.residencyTo ? ` – ${formatIstDate(program.residencyTo)}` : program.isOngoing ? ' — ongoing' : ''}
          </p>
        ) : null}
        {program.description ? (
          <p className="text-fg-secondary mt-6 whitespace-pre-line">{program.description}</p>
        ) : null}
      </Container>
    </Section>
  );
}
