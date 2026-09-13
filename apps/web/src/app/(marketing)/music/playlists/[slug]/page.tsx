import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { secondsToDuration } from '@dj/utils';

import { Container, Section } from '../../../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../../../lib/json-ld';
import { absoluteUrl } from '../../../../../lib/site';
import { getPlaylist } from '../../../../../server/queries/playlists';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const playlist = await getPlaylist(slug);
  if (!playlist) return {};
  return {
    title: playlist.title,
    description: playlist.description ?? undefined,
    alternates: { canonical: absoluteUrl(`/music/playlists/${slug}`) },
  };
}

export default async function PlaylistPage({
  params,
}: {
  params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const playlist = await getPlaylist(slug);
  if (!playlist) notFound();

  const url = absoluteUrl(`/music/playlists/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'MusicPlaylist',
      '@id': `${url}#playlist`,
      name: playlist.title,
      numTracks: playlist.tracks.length,
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <h1 className="font-display text-h1 text-fg-strong">{playlist.title}</h1>
        {playlist.description ? <p className="text-fg-secondary mt-4">{playlist.description}</p> : null}
        {playlist.totalDurationSec ? (
          <p className="text-fg-muted mt-2 text-sm">
            {playlist.tracks.length} tracks · {secondsToDuration(playlist.totalDurationSec)}
          </p>
        ) : null}
        <ol className="mt-8 space-y-2">
          {playlist.tracks.map((track, index) => (
            <li key={track.id}>
              <Link
                href={`/music/${track.slug}`}
                className="flex items-baseline justify-between gap-3 rounded-md border border-border p-4 hover:border-accent"
              >
                <span>
                  <span className="text-fg-muted mr-3 text-sm">{index + 1}.</span>
                  <span className="text-fg-strong font-medium">{track.title}</span>
                </span>
                {track.note ? <span className="text-fg-muted text-xs">{track.note}</span> : null}
              </Link>
            </li>
          ))}
        </ol>
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
