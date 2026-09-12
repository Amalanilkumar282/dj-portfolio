import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { secondsToDuration } from '@dj/utils';

import { Container, Section } from '../../../../components/container';
import { PlayButton } from '../../../../components/player/play-button';
import { JsonLd, type JsonLdNode } from '../../../../lib/json-ld';
import { absoluteUrl } from '../../../../lib/site';
import { getTrack } from '../../../../server/queries/tracks';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const track = await getTrack(slug);
  if (!track) return {};
  const url = absoluteUrl(`/music/${slug}`);
  return {
    title: track.title,
    description: track.description ?? `${track.title} by ${track.artistLabel}`,
    alternates: { canonical: url },
    openGraph: { url, type: 'music.song' },
  };
}

export default async function TrackPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const track = await getTrack(slug);
  if (!track) notFound();

  const url = absoluteUrl(`/music/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'MusicRecording',
      '@id': `${url}#recording`,
      name: track.title,
      byArtist: { '@type': 'MusicGroup', name: track.artistLabel },
      duration: track.durationSec ? `PT${String(track.durationSec)}S` : undefined,
      datePublished: track.releaseDate ? track.releaseDate.toISOString() : undefined,
      sameAs: track.streamLinks.map((link) => link.url),
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <p className="text-eyebrow text-accent font-semibold uppercase">{track.type.replace('_', ' ')}</p>
        <h1 className="font-display text-h1 text-fg-strong mt-4">{track.title}</h1>
        <p className="text-fg-secondary mt-2">{track.artistLabel}</p>
        <dl className="text-fg-muted mt-6 flex flex-wrap gap-6 text-sm">
          {track.bpm ? (
            <div>
              <dt className="inline font-semibold">BPM </dt>
              <dd className="inline">{track.bpm}</dd>
            </div>
          ) : null}
          {track.musicalKey ? (
            <div>
              <dt className="inline font-semibold">Key </dt>
              <dd className="inline">{track.musicalKey}</dd>
            </div>
          ) : null}
          {track.durationSec ? (
            <div>
              <dt className="inline font-semibold">Length </dt>
              <dd className="inline">{secondsToDuration(track.durationSec)}</dd>
            </div>
          ) : null}
        </dl>
        {track.description ? <p className="text-fg-secondary mt-6 whitespace-pre-line">{track.description}</p> : null}
        {track.audioUrl ? (
          <div className="mt-8">
            <PlayButton
              track={{ id: track.id, title: track.title, artistLabel: track.artistLabel, audioUrl: track.audioUrl }}
            />
          </div>
        ) : null}
        {track.embedUrl ? (
          <div className="mt-8 overflow-hidden rounded-md border border-border">
            <iframe
              title={`${track.title} player`}
              src={track.embedUrl}
              width="100%"
              height="166"
              loading="lazy"
              className="border-0"
            />
          </div>
        ) : null}
        {track.streamLinks.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-3">
            {track.streamLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="rounded-full border border-border px-4 py-2 text-sm text-fg-secondary hover:border-accent"
                >
                  {link.platform.replace('_', ' ')}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {track.tags.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-2">
            {track.tags.map((tag) => (
              <li key={tag} className="text-fg-muted text-xs">
                #{tag}
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
