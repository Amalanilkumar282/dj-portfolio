import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonClass, Chip } from '@dj/ui/primitives';
import { stripMarkdown, truncate } from '@dj/utils';


import { StageBackdrop } from '../../../components/cinematic/stage-backdrop';
import { StageProvider } from '../../../components/cinematic/stage-context';
import { CloudinaryImage } from '../../../components/cloudinary-image';
import { Container, Section } from '../../../components/container';
import { GigMap, type MapVenue } from '../../../components/home/gig-map';
import { Marquee } from '../../../components/home/marquee';
import { TrackWall, type WallTrack } from '../../../components/home/track-wall';
import { MagneticLink } from '../../../components/magnetic-link';
import { JsonLd, type JsonLdNode } from '../../../lib/json-ld';
import { cloudinaryOgUrl, SIZES } from '../../../lib/media';
import { absoluteUrl } from '../../../lib/site';
import { getPersonaPage } from '../../../server/queries/personas';
import { getTracks } from '../../../server/queries/tracks';

interface Params {
  persona: string;
}

/**
 * One channel, in full.
 *
 * The same act vocabulary as the homepage, tuned to a single persona. The
 * layout above already sets `data-theme` and the CMS accent server-side, so
 * the page arrives in its own colour with no flash and no client branching —
 * TNT picks up its mono display face and 2px radii purely from the token
 * layer.
 */

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
    openGraph: {
      url,
      type: 'profile',
      images: persona.heroImage ? [{ url: cloudinaryOgUrl(persona.heroImage.publicId) }] : undefined,
    },
  };
}

export default async function PersonaPage({
  params,
}: {
  params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const { persona: slug } = await params;

  // Sequential, not Promise.all: `getTracks` validates `personaSlug` against
  // the real slug format and throws on anything else (e.g. a stray
  // `/favicon.ico` request falling through to this dynamic segment before
  // any static file existed for it). Fetching it in parallel meant that
  // throw could win the race before the `notFound()` below ever ran, so an
  // unknown or malformed slug surfaced as an unhandled 422/500 instead of a
  // clean 404.
  const page = await getPersonaPage(slug);
  if (!page) notFound();
  const personaTracks = await getTracks({ personaSlug: slug });

  const { persona, playlists, programs, venuesPlayed, releases } = page;
  const url = absoluteUrl(`/${slug}`);

  const wallTracks: WallTrack[] = personaTracks.map((track) => ({
    id: track.id,
    slug: track.slug,
    title: track.title,
    artistLabel: track.artistLabel,
    bpm: track.bpm,
    audioUrl: null,
    soundcloudTrackId: track.soundcloudTrackId,
    type: track.type,
    musicalKey: track.musicalKey,
    durationSec: track.durationSec,
    personaSlug: track.personaSlug,
    isFeatured: track.isFeatured,
    playable: track.soundcloudTrackId !== null,
  }));

  const mapVenues: MapVenue[] = venuesPlayed
    .filter(
      (venue): venue is typeof venue & { latitude: number; longitude: number } =>
        venue.latitude !== null && venue.longitude !== null,
    )
    .map((venue) => ({
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      city: venue.city,
      state: venue.state,
      latitude: venue.latitude,
      longitude: venue.longitude,
      capacity: venue.capacity,
    }));

  const bpmRange =
    persona.bpmRangeLow !== null && persona.bpmRangeHigh !== null
      ? `${String(persona.bpmRangeLow)}–${String(persona.bpmRangeHigh)} BPM`
      : null;

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
    <StageProvider initialThemeKey={persona.key}>
      {/* Hero */}
      {/* `isolate` is load-bearing: a bare `relative` does not create a
          stacking context, so the `-z-10` backdrop would escape to the root
          and paint *behind* body's background - i.e. be invisible. */}
      <section
        aria-labelledby="persona-title"
        className="relative isolate flex min-h-[88svh] items-end overflow-hidden pb-16"
      >
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <StageBackdrop videoUrl={persona.bgVideoUrl} />
        </div>

        <Container>
          {persona.heroImage ? (
            <div className="relative mb-10 aspect-video w-full overflow-hidden rounded-lg">
              <CloudinaryImage
                image={persona.heroImage}
                sizes={SIZES.heroFull}
                priority
                fill
                className="object-cover"
              />
            </div>
          ) : null}

          <p className="text-eyebrow text-accent font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase">
            {persona.homeCity ?? 'Bengaluru'}
            {persona.primaryGenreLabel ? ` · ${persona.primaryGenreLabel}` : ''}
          </p>

          <h1
            id="persona-title"
            className="font-display text-display text-fg-strong dj-rise-mask mt-4"
          >
            <span>{persona.stageName}</span>
          </h1>

          {persona.subtitle ? (
            <p className="text-lead text-fg-secondary dj-reveal mt-6 max-w-xl">{persona.subtitle}</p>
          ) : null}

          <dl className="text-fg-muted mt-10 flex flex-wrap gap-x-10 gap-y-4 font-mono text-xs uppercase">
            {bpmRange ? <Fact label="Tempo" value={bpmRange} /> : null}
            <Fact label="Tracks" value={String(personaTracks.length)} />
            {programs.length > 0 ? (
              <Fact label="Residencies" value={String(programs.length)} />
            ) : null}
            {persona.yearsActiveFrom !== null ? (
              <Fact label="Since" value={String(persona.yearsActiveFrom)} />
            ) : null}
          </dl>

          <div className="mt-10 flex flex-wrap gap-4">
            <MagneticLink href="/book" className={buttonClass({ variant: 'solid', size: 'lg' })}>
              Book {persona.stageName}
            </MagneticLink>
            <Link
              href={`/${slug}/music`}
              className={buttonClass({ variant: 'outline', size: 'lg' })}
            >
              Full discography
            </Link>
          </div>
        </Container>
      </section>

      {/* The story */}
      <Section aria-labelledby="bio-title">
        <Container className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2
              id="bio-title"
              className="font-display text-h2 text-fg-strong dj-reveal mb-6"
            >
              The sound
            </h2>
            <p className="text-fg-secondary text-lead whitespace-pre-line">{persona.bio}</p>
          </div>

          <div>
            {persona.genres.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {persona.genres.map((genre) => (
                  <li key={genre.slug}>
                    <Chip tone="accent" size="md">
                      {genre.name}
                    </Chip>
                  </li>
                ))}
              </ul>
            ) : null}

            {persona.memberNames.length > 0 ? (
              <p className="text-fg-muted mt-8 font-mono text-xs uppercase">
                {persona.memberNames.join(' · ')}
              </p>
            ) : null}

            {persona.socialLinks.length > 0 ? (
              <ul className="mt-8 flex flex-wrap gap-3">
                {persona.socialLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      rel="me noreferrer"
                      target="_blank"
                      className={buttonClass({ variant: 'ghost', size: 'sm' })}
                    >
                      {link.platform.toLowerCase()}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Container>
      </Section>

      {/* Sound */}
      {wallTracks.length > 0 ? (
        <Section aria-labelledby="persona-sound-title" className="bg-surface/40">
          <Container>
            <h2
              id="persona-sound-title"
              className="font-display text-h2 text-fg-strong dj-reveal mb-10"
            >
              {personaTracks.length} tracks
            </h2>
            {/* No persona filter chips here: the whole wall is already one
                channel, so the filter would have exactly one option. */}
            <TrackWall tracks={wallTracks} personas={[]} />
          </Container>
        </Section>
      ) : null}

      {/* Playlists and releases */}
      {playlists.length + releases.length > 0 ? (
        <Section aria-labelledby="collections-title">
          <Container>
            <h2
              id="collections-title"
              className="font-display text-h2 text-fg-strong dj-reveal mb-10"
            >
              Sets and releases
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((playlist) => (
                <li key={playlist.id}>
                  <Link
                    href={`/music/playlists/${playlist.slug}`}
                    className="border-border hover-hover:hover:border-accent flex h-full flex-col rounded-md border p-6 transition-[border-color] duration-(--duration-fast)"
                  >
                    <p className="font-display text-h4 text-fg-strong">{playlist.title}</p>
                    <p className="text-accent mt-auto pt-6 font-mono text-xs uppercase">
                      Playlist · {String(playlist.trackCount)} tracks
                    </p>
                  </Link>
                </li>
              ))}
              {releases.map((release) => (
                <li key={release.id}>
                  <Link
                    href={`/music/albums/${release.slug}`}
                    className="border-border hover-hover:hover:border-accent flex h-full flex-col rounded-md border p-6 transition-[border-color] duration-(--duration-fast)"
                  >
                    <p className="font-display text-h4 text-fg-strong">{release.title}</p>
                    <p className="text-accent mt-auto pt-6 font-mono text-xs uppercase">Release</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Residencies */}
      {programs.length > 0 ? (
        <Section aria-labelledby="persona-programs-title" className="bg-surface/40">
          <Container>
            <h2
              id="persona-programs-title"
              className="font-display text-h2 text-fg-strong dj-reveal mb-10"
            >
              Standing nights
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <li key={program.id}>
                  <Link
                    href={`/programs/${program.slug}`}
                    className="border-border hover-hover:hover:border-accent flex h-full flex-col rounded-md border p-6 transition-[border-color] duration-(--duration-fast)"
                  >
                    <p className="font-display text-h4 text-fg-strong">{program.name}</p>
                    {program.subtitle ? (
                      <p className="text-fg-muted mt-2 text-sm">{program.subtitle}</p>
                    ) : null}
                    <p className="text-accent mt-auto pt-6 font-mono text-xs uppercase">
                      {program.cadence ?? 'Ongoing'}
                      {program.venueName ? ` · ${program.venueName}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Rooms played */}
      {mapVenues.length > 0 ? (
        <Section aria-labelledby="persona-venues-title">
          <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2
                id="persona-venues-title"
                className="font-display text-h2 text-fg-strong dj-reveal mb-6"
              >
                Rooms played
              </h2>
              <p className="text-lead text-fg-secondary">
                {mapVenues.length} venues across{' '}
                {new Set(mapVenues.map((venue) => venue.city)).size} cities.
              </p>
            </div>
            <GigMap venues={mapVenues} />
          </Container>
        </Section>
      ) : null}

      {persona.genres.length > 0 ? (
        <Marquee items={persona.genres.map((genre) => genre.name)} className="py-8" />
      ) : null}

      {/* Book */}
      <Section aria-labelledby="persona-book-title">
        <Container className="text-center">
          <h2
            id="persona-book-title"
            className="font-display text-h1 text-fg-strong mx-auto max-w-3xl"
          >
            Book {persona.stageName}.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <MagneticLink href="/book" className={buttonClass({ variant: 'solid', size: 'lg' })}>
              Start a booking
            </MagneticLink>
            <Link href="/" className={buttonClass({ variant: 'ghost', size: 'lg' })}>
              Other channels
            </Link>
          </div>
        </Container>
      </Section>

      <JsonLd graph={graph} />
    </StageProvider>
  );
}

function Fact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <dt className="opacity-60">{label}</dt>
      <dd className="text-fg-strong font-display text-h4 mt-1">{value}</dd>
    </div>
  );
}
