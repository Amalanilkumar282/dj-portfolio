import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container, Section, SectionHeader } from '../../../../components/container';
import { absoluteUrl } from '../../../../lib/site';
import { getPersona } from '../../../../server/queries/personas';
import { getTracks } from '../../../../server/queries/tracks';

interface Params {
  persona: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { persona: slug } = await params;
  const persona = await getPersona(slug);
  if (!persona) return {};
  return {
    title: `Music — ${persona.stageName}`,
    alternates: { canonical: absoluteUrl(`/${slug}/music`) },
  };
}

export default async function PersonaMusicPage({
  params,
}: {
  params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const { persona: slug } = await params;
  const persona = await getPersona(slug);
  if (!persona) notFound();

  const tracks = await getTracks({ personaSlug: slug });

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow={persona.stageName} title="Music" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <Link
              key={track.id}
              href={`/music/${track.slug}`}
              className="rounded-md border border-border bg-surface p-5 hover:border-accent"
            >
              <p className="text-fg-strong font-semibold">{track.title}</p>
              <p className="text-fg-muted mt-1 text-sm">{track.type.replace('_', ' ')}</p>
            </Link>
          ))}
        </div>
        {tracks.length === 0 ? <p className="text-fg-muted">No tracks published yet.</p> : null}
      </Container>
    </Section>
  );
}
