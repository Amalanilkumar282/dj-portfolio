import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container, Section } from '../../../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../../../lib/json-ld';
import { absoluteUrl } from '../../../../../lib/site';
import { getRelease } from '../../../../../server/queries/releases';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const release = await getRelease(slug);
  if (!release) return {};
  return {
    title: release.title,
    alternates: { canonical: absoluteUrl(`/music/albums/${slug}`) },
  };
}

export default async function ReleasePage({
  params,
}: {
  params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const release = await getRelease(slug);
  if (!release) notFound();

  const url = absoluteUrl(`/music/albums/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'MusicAlbum',
      '@id': `${url}#album`,
      name: release.title,
      numTracks: release.tracks.length,
      datePublished: release.releaseDate ? release.releaseDate.toISOString() : undefined,
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <p className="text-eyebrow text-accent font-semibold uppercase">{release.type}</p>
        <h1 className="font-display text-h1 text-fg-strong mt-4">{release.title}</h1>
        {release.description ? (
          <p className="text-fg-secondary mt-4 whitespace-pre-line">{release.description}</p>
        ) : null}
        {release.tracks.length > 0 ? (
          <ol className="mt-8 space-y-2">
            {release.tracks.map((track, index) => (
              <li key={track.id}>
                <Link
                  href={`/music/${track.slug}`}
                  className="flex items-baseline gap-3 rounded-md border border-border p-4 hover:border-accent"
                >
                  <span className="text-fg-muted text-sm">{index + 1}.</span>
                  <span className="text-fg-strong font-medium">{track.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
