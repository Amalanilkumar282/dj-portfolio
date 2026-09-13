import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getPlaylists } from '../../../server/queries/playlists';
import { getReleases } from '../../../server/queries/releases';
import { getTracks } from '../../../server/queries/tracks';

export const metadata: Metadata = {
  title: 'Music',
  description: 'Original productions, remixes, live sets and mixes from every DJ Felicitous act.',
  alternates: { canonical: absoluteUrl('/music') },
};

export default async function MusicPage(): Promise<React.JSX.Element> {
  const [tracks, releases, playlists] = await Promise.all([getTracks(), getReleases(), getPlaylists()]);

  return (
    <>
      <Section className="pt-20">
        <Container>
          <SectionHeader eyebrow="Discography" title="Music" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => (
              <Link
                key={track.id}
                href={`/music/${track.slug}`}
                className="rounded-md border border-border bg-surface p-5 hover:border-accent"
              >
                <p className="text-fg-strong font-semibold">{track.title}</p>
                <p className="text-fg-muted mt-1 text-sm">{track.artistLabel}</p>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {releases.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeader title="Releases" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {releases.map((release) => (
                <Link
                  key={release.id}
                  href={`/music/albums/${release.slug}`}
                  className="rounded-md border border-border bg-bg p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{release.title}</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {playlists.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader title="Playlists" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist) => (
                <Link
                  key={playlist.id}
                  href={`/music/playlists/${playlist.slug}`}
                  className="rounded-md border border-border bg-surface p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{playlist.title}</p>
                  <p className="text-fg-muted mt-1 text-sm">{playlist.trackCount} tracks</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
