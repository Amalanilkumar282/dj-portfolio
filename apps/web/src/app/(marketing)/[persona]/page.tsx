import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatEventDateRange, stripMarkdown, truncate } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../lib/json-ld';
import { absoluteUrl } from '../../../lib/site';
import { getPersonaPage } from '../../../server/queries/personas';

interface Params {
  persona: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { persona: slug } = await params;
  const page = await getPersonaPage(slug);
  if (!page) return {};

  const { persona } = page;
  const url = absoluteUrl(`/${slug}`);
  const description = truncate(stripMarkdown(persona.bio), 155);

  return {
    title: `${persona.stageName} — ${persona.primaryGenreLabel ?? 'DJ'}`,
    description,
    alternates: { canonical: url },
    openGraph: { url, type: 'profile', images: persona.heroImage ? [{ url: persona.heroImage.publicId }] : undefined },
  };
}

export default async function PersonaPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { persona: slug } = await params;
  const page = await getPersonaPage(slug);
  if (!page) notFound();

  const { persona, featuredTracks, playlists, upcomingEvents, programs, venuesPlayed, releases } = page;
  const url = absoluteUrl(`/${slug}`);

  const graph: JsonLdNode[] = [
    {
      '@type': 'MusicGroup',
      '@id': `${url}#musicgroup`,
      name: persona.stageName,
      url,
      genre: persona.primaryGenreLabel ?? undefined,
      foundingLocation: persona.homeCity ?? undefined,
      member: persona.memberNames.map((name) => ({ '@type': 'Person', name })),
      sameAs: persona.socialLinks.map((link) => link.url),
    },
  ];

  return (
    <>
      <Section className="pt-20">
        <Container>
          <p className="text-eyebrow text-accent font-semibold uppercase">
            {persona.homeCity ?? 'Bengaluru'}
          </p>
          <h1 className="font-display text-display text-fg-strong mt-4">{persona.stageName}</h1>
          {persona.subtitle ? <p className="text-lead text-fg-secondary mt-4">{persona.subtitle}</p> : null}
          <p className="text-fg-secondary mt-6 max-w-2xl whitespace-pre-line">{persona.bio}</p>
          {persona.genres.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {persona.genres.map((genre) => (
                <li
                  key={genre.slug}
                  className="rounded-full border border-border px-3 py-1 text-xs text-fg-secondary"
                >
                  {genre.name}
                </li>
              ))}
            </ul>
          ) : null}
        </Container>
      </Section>

      {featuredTracks.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader title="Music" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTracks.map((track) => (
                <Link
                  key={track.id}
                  href={`/music/${track.slug}`}
                  className="rounded-md border border-border bg-surface p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{track.title}</p>
                </Link>
              ))}
            </div>
            <Link href={`/${slug}/music`} className="text-accent mt-6 inline-block text-sm underline">
              All music from {persona.stageName} →
            </Link>
          </Container>
        </Section>
      ) : null}

      {playlists.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeader title="Playlists" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist) => (
                <Link
                  key={playlist.id}
                  href={`/music/playlists/${playlist.slug}`}
                  className="rounded-md border border-border bg-bg p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{playlist.title}</p>
                  <p className="text-fg-muted mt-1 text-sm">{playlist.trackCount} tracks</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {releases.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader title="Releases" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {releases.map((release) => (
                <Link
                  key={release.id}
                  href={`/music/albums/${release.slug}`}
                  className="rounded-md border border-border bg-surface p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{release.title}</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeader title="Upcoming shows" />
            <ul className="space-y-4">
              {upcomingEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.slug}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-bg p-5 hover:border-accent"
                  >
                    <span className="text-fg-strong font-semibold">{event.title}</span>
                    <span className="text-fg-muted text-sm">
                      {formatEventDateRange(event.startsAt, event.endsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {programs.length > 0 ? (
        <Section>
          <Container>
            <SectionHeader title="Residencies" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <Link
                  key={program.id}
                  href={`/programs/${program.slug}`}
                  className="rounded-md border border-border bg-surface p-5 hover:border-accent"
                >
                  <p className="text-fg-strong font-semibold">{program.name}</p>
                </Link>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {venuesPlayed.length > 0 ? (
        <Section className="bg-surface">
          <Container>
            <SectionHeader title="Venues played" />
            <ul className="flex flex-wrap gap-3">
              {venuesPlayed.map((venue) => (
                <li key={venue.id}>
                  <Link
                    href={`/venues/${venue.slug}`}
                    className="rounded-full border border-border px-4 py-2 text-sm text-fg-secondary hover:border-accent"
                  >
                    {venue.name}, {venue.city}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      <JsonLd graph={graph} />
    </>
  );
}
