import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonClass, Card, cardClass, Chip } from '@dj/ui/primitives';
import { isoWithIstOffset } from '@dj/utils';

import type { Channel } from '../../components/cinematic/channel-switcher';
import { StageBackdrop } from '../../components/cinematic/stage-backdrop';
import { StageProvider } from '../../components/cinematic/stage-context';
import { Container, Section } from '../../components/container';
import { ChannelAct } from '../../components/home/channel-act';
import { CountUp } from '../../components/home/count-up';
import { GalleryRail } from '../../components/home/gallery-rail';
import { Marquee } from '../../components/home/marquee';
import { Residencies } from '../../components/home/residencies';
import { ShowsAct } from '../../components/home/shows-act';
import { TrackWall, type WallTrack } from '../../components/home/track-wall';
import { VenueList } from '../../components/home/venue-list';
import { VideoRail } from '../../components/home/video-rail';
import { MagneticLink } from '../../components/magnetic-link';
import { JsonLd, type JsonLdNode } from '../../lib/json-ld';
import { absoluteUrl, SITE } from '../../lib/site';
import { getLiveEvents, getPastEvents, getUpcomingEvents } from '../../server/queries/events';
import { getExperience } from '../../server/queries/experience';
import { getGalleries } from '../../server/queries/galleries';
import { getPersona, getPersonas } from '../../server/queries/personas';
import { getPrograms } from '../../server/queries/programs';
import { getServices } from '../../server/queries/services';
import { getSettings } from '../../server/queries/settings';
import { getStats } from '../../server/queries/stats';
import { getTestimonials } from '../../server/queries/testimonials';
import { getTracks } from '../../server/queries/tracks';
import { getVenues } from '../../server/queries/venues';
import { getVideos } from '../../server/queries/videos';

/**
 * The homepage is the site.
 *
 * Most promoters never open a second page — that is the premise the whole
 * page is built on, and the reason this file is long. Every area of the site
 * is represented here with **real content** rather than a teaser: the
 * catalogue is playable in place, the shows are browsable in place, and the
 * residencies are the real weekly nights.
 *
 * This file stays a Server Component (`dj/no-client-in-route-files`). The
 * interactive parts are small client islands — the stage backdrop, the
 * channel switcher, the track wall, the poster rails, the video lightbox and
 * the counters. Nothing autoplays sound, no third-party iframe mounts until
 * the viewer asks for one, and no island is the only route to a piece of
 * information.
 *
 * **Two heavier islands used to live here and no longer do**: a procedural 3D
 * CDJ (Act 4) and a rotary browse wheel (Act 5). Both were well built; both
 * were interactions a promoter evaluating a booking will not use, and between
 * them they occupied about a third of the scroll and pulled `three` into the
 * route. The space is now shows, venues, photos and video — the things the
 * artist's own brief asked for. The components remain on disk and still work;
 * they are simply not imported here. See ADR 0024.
 *
 * **Section visibility and the hero/closing copy come from Settings**, so the
 * artist can retitle or hide any of this himself. Each section additionally
 * hides itself when it has no content, so an empty catalogue never renders a
 * heading over nothing — an "Upcoming shows" title with nothing under it
 * advertises that there is no work on.
 */

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
  openGraph: { url: absoluteUrl('/'), type: 'website' },
};

export default async function HomePage(): Promise<React.JSX.Element> {
  // One clock read for the whole render. Every show badge, rail bucket and
  // countdown is resolved against this single instant, so two identical
  // events either side of a minute boundary cannot disagree on the same page.
  const now = new Date();

  const [
    personaSummaries,
    tracks,
    venues,
    programs,
    experience,
    services,
    stats,
    testimonials,
    settings,
    upcomingEvents,
    pastEvents,
    liveEvents,
    galleries,
    videos,
  ] = await Promise.all([
    getPersonas(),
    getTracks(),
    getVenues(),
    getPrograms(),
    getExperience(),
    getServices(),
    getStats(),
    getTestimonials({ limit: 6 }),
    getSettings(),
    getUpcomingEvents({ limit: 24 }),
    getPastEvents({ limit: 12 }),
    getLiveEvents(),
    getGalleries(),
    getVideos({ limit: 12 }),
  ]);

  // Details carry the genre list the switcher shows. Four extra round trips,
  // all `React.cache()`d and all issued in parallel.
  const personas = (
    await Promise.all(personaSummaries.map((persona) => getPersona(persona.slug)))
  ).filter((persona) => persona !== null);

  const channels: Channel[] = personas.map((persona) => ({
    id: persona.id,
    slug: persona.slug,
    key: persona.key,
    stageName: persona.stageName,
    subtitle: persona.subtitle,
    shortDescription: persona.shortDescription,
    primaryGenreLabel: persona.primaryGenreLabel,
    accentColor: persona.accentColor,
    accentColorSecondary: persona.accentColorSecondary,
    gradientCss: persona.gradientCss,
    trackCount: tracks.filter((track) => track.personaSlug === persona.slug).length,
    avatarImage: persona.avatarImage,
  }));

  // The homepage isn't scoped to one persona, so there's no single "right"
  // hero photo — the site-wide `homeHeroImage` (set in admin Settings) is
  // the deliberate choice for this slot; the first persona's hero image is
  // a last-resort fallback so the hero isn't left showing only the
  // generative shader when the artist hasn't set either.
  const fallbackHeroImage = settings.homeHeroImage ?? personas[0]?.heroImage ?? null;

  const wallTracks: WallTrack[] = tracks.map((track) => ({
    id: track.id,
    slug: track.slug,
    title: track.title,
    artistLabel: track.artistLabel,
    bpm: track.bpm,
    // No track has a self-hosted file yet; SoundCloud is the real transport.
    audioUrl: null,
    soundcloudTrackId: track.soundcloudTrackId,
    type: track.type,
    musicalKey: track.musicalKey,
    durationSec: track.durationSec,
    personaSlug: track.personaSlug,
    isFeatured: track.isFeatured,
    playable: track.soundcloudTrackId !== null,
  }));

  const genreLabels = [
    ...new Set(personas.flatMap((persona) => persona.genres.map((genre) => genre.name))),
  ];

  const residencies = programs.filter((program) => program.isOngoing);
  const liveResidency = residencies[0] ?? programs[0] ?? null;

  const hasShows = liveEvents.length + upcomingEvents.length + pastEvents.length > 0;

  const graph: JsonLdNode[] = [
    {
      '@type': 'Person',
      '@id': `${absoluteUrl('/')}#person`,
      name: 'DJ Felicitous',
      url: absoluteUrl('/'),
      jobTitle: 'DJ & Producer',
    },
    {
      '@type': 'EntertainmentBusiness',
      '@id': `${absoluteUrl('/')}#business`,
      name: settings.siteName,
      telephone: settings.contactPhone ?? undefined,
      email: settings.contactEmail,
      areaServed: ['Bengaluru', 'Karnataka', 'India'],
      address: settings.addressCity
        ? {
            '@type': 'PostalAddress',
            addressLocality: settings.addressCity,
            addressRegion: settings.addressRegion ?? undefined,
            addressCountry: settings.addressCountry ?? 'IN',
          }
        : undefined,
      geo:
        settings.latitude != null && settings.longitude != null
          ? { '@type': 'GeoCoordinates', latitude: settings.latitude, longitude: settings.longitude }
          : undefined,
    },
    {
      '@type': 'ItemList',
      name: 'Personas',
      itemListElement: personas.map((persona, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(`/${persona.slug}`),
        name: persona.stageName,
      })),
    },
  ];

  // Upcoming gigs as real MusicEvent nodes, so they can surface as rich
  // results. `isoWithIstOffset`, never a bare Z — a UTC timestamp makes
  // Google display an Indian gig at the wrong local time.
  const schedulableEvents = [...liveEvents, ...upcomingEvents].slice(0, 10);
  if (schedulableEvents.length > 0) {
    graph.push({
      '@type': 'ItemList',
      name: 'Upcoming shows',
      itemListElement: schedulableEvents.map((event, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'MusicEvent',
          name: event.title,
          url: absoluteUrl(`/events/${event.slug}`),
          startDate: isoWithIstOffset(event.startsAt),
          ...(event.endsAt ? { endDate: isoWithIstOffset(event.endsAt) } : {}),
          ...(event.venueName
            ? {
                location: {
                  '@type': 'Place',
                  name: event.venueName,
                  ...(event.city
                    ? { address: { '@type': 'PostalAddress', addressLocality: event.city } }
                    : {}),
                },
              }
            : {}),
        },
      })),
    });
  }

  return (
    <StageProvider>
      {/* Act 1 - Hero.

          `isolate` is load-bearing: a bare `relative` does not create a
          stacking context, so the `-z-10` backdrop would escape to the root
          and paint *behind* body's background - i.e. be invisible. */}
      <section
        aria-labelledby="hero-title"
        className="relative isolate flex min-h-svh items-end overflow-hidden pb-20"
      >
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <StageBackdrop videoUrl={settings.homeHeroVideoUrl} heroImage={fallbackHeroImage} />
        </div>

        <Container>
          {liveResidency ? (
            <p className="mb-6">
              <Chip tone="accent" size="md">
                <span className="bg-accent motion-ok:animate-[rhythm-pulse_var(--beat,1s)_ease-in-out_infinite] inline-block size-1.5 rounded-full" />
                Resident · {liveResidency.name}
                {liveResidency.cadence ? ` · ${liveResidency.cadence.toLowerCase()}` : ''}
              </Chip>
            </p>
          ) : null}

          <p className="text-eyebrow text-accent font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase">
            {settings.homeHeroEyebrow ?? 'Bengaluru · India'}
          </p>

          {/* One accessible string. The mask reveal animates spans inside the
              heading; the heading is never split into separate elements.
              A custom headline is rendered as one span - the two-tone split
              is a property of the default copy, not something to impose on
              whatever the artist types. */}
          <h1
            id="hero-title"
            className="font-display text-display text-fg-strong dj-rise-mask mt-4 max-w-5xl"
          >
            {settings.homeHeroHeadline ? (
              <span>{settings.homeHeroHeadline}</span>
            ) : (
              <>
                <span>One artist.</span> <span className="text-accent">Four sounds.</span>
              </>
            )}
          </h1>

          <p className="text-lead text-fg-secondary dj-reveal mt-8 max-w-xl">
            {settings.homeHeroSubheadline ?? SITE.defaultDescription}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <MagneticLink href="/book" className={buttonClass({ variant: 'solid', size: 'lg' })}>
              Book now
            </MagneticLink>
            <Link href="#sound" className={buttonClass({ variant: 'outline', size: 'lg' })}>
              Listen now
            </Link>
          </div>

          {/* The genre cloud the sketch put directly under the hero: the
              fastest possible answer to "does he play what my room needs". */}
          {genreLabels.length > 0 ? (
            <ul className="mt-12 flex flex-wrap gap-2" aria-label="Genres played">
              {genreLabels.map((genre) => (
                <li key={genre}>
                  <Chip>{genre}</Chip>
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="text-fg-muted mt-10 flex flex-wrap gap-x-10 gap-y-4 font-mono text-xs uppercase">
            <Fact label="Channels" value={String(personas.length)} />
            <Fact label="Tracks" value={String(tracks.length)} />
            <Fact label="Residencies" value={String(residencies.length)} />
            <Fact label="Venues" value={String(venues.length)} />
          </dl>
        </Container>
      </section>

      {/* Act 2 - Musical identities */}
      {settings.homeShowIdentities && channels.length > 0 ? (
        <Section aria-labelledby="channels-title" className="relative">
          <Container>
            <ActHeader
              id="channels-title"
              eyebrow="Musical identities"
              title="Four channels, one artist"
              description="Each identity has its own sound, its own tempo and its own colour. Pick one and the whole site retunes to it."
            />
            <ChannelAct channels={channels} />
          </Container>
        </Section>
      ) : null}

      {/* Act 3 - Shows and flyers */}
      {settings.homeShowShows && hasShows ? (
        <Section aria-labelledby="shows-title" className="bg-surface/40">
          <Container>
            <ActHeader
              id="shows-title"
              eyebrow="Shows"
              title="Where the nights happen"
              description="Everything announced, on sale and recently played — flyers, dates, rooms and tickets."
            />
            <ShowsAct
              live={liveEvents}
              upcoming={upcomingEvents}
              past={pastEvents}
              now={now}
            />
          </Container>
        </Section>
      ) : null}

      {/* Act 4 - Discography */}
      {settings.homeShowDiscography && wallTracks.length > 0 ? (
        <Section id="sound" aria-labelledby="sound-title">
          <Container>
            <ActHeader
              id="sound-title"
              eyebrow="Discography"
              title={`${String(tracks.length)} tracks, playable right here`}
              description="Originals, remixes and live sets. Everything plays in place, and keeps playing while you move around the site."
            />
            <TrackWall
              tracks={wallTracks}
              filterBy="type"
              personas={personas.map((persona) => ({
                slug: persona.slug,
                stageName: persona.stageName,
              }))}
            />
            <div className="mt-10">
              <Link href="/music" className={buttonClass({ variant: 'outline', size: 'md' })}>
                Explore the full collection
              </Link>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* Act 5 - Residencies */}
      {settings.homeShowResidencies ? (
        <Section aria-labelledby="residencies-title" className="bg-surface/40">
          <Container>
            <ActHeader
              id="residencies-title"
              eyebrow="Resident DJ"
              title="Standing nights"
              description="Not one-off bookings. These run every week."
            />
            <Residencies programs={programs} experience={experience} />
          </Container>
        </Section>
      ) : null}

      {/* Act 6 - Recently played venues */}
      {settings.homeShowVenues && venues.length > 0 ? (
        <Section aria-labelledby="venues-title">
          <Container>
            <ActHeader
              id="venues-title"
              eyebrow="Rooms played"
              title="Recently played venues"
            />
            <VenueList venues={venues} />
          </Container>
        </Section>
      ) : null}

      {/* Act 7 - Gallery */}
      {settings.homeShowGallery && galleries.length > 0 ? (
        <Section aria-labelledby="gallery-title" className="bg-surface/40">
          <Container>
            <ActHeader id="gallery-title" eyebrow="Gallery" title="Photos from the floor" />
            <GalleryRail galleries={galleries} />
            <div className="mt-8">
              <Link href="/gallery" className={buttonClass({ variant: 'outline', size: 'md' })}>
                See every gallery
              </Link>
            </div>
          </Container>
        </Section>
      ) : null}

      {/* Act 8 - Videos */}
      {settings.homeShowVideos && videos.length > 0 ? (
        <Section aria-labelledby="videos-title">
          <Container>
            <ActHeader id="videos-title" eyebrow="Videos" title="Sets, recaps and clips" />
            <VideoRail videos={videos} />
          </Container>
        </Section>
      ) : null}

      {/* Act 9 - What I do */}
      {settings.homeShowServices && services.length > 0 ? (
        <Section aria-labelledby="services-title" className="bg-surface/40">
          <Container>
            <ActHeader
              id="services-title"
              eyebrow="What I do"
              title="Built around the night you are planning"
              description="Every quote is scoped to the room, the hours and the production. Nothing is off the shelf."
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <li key={service.id}>
                  <Link href={`/services/${service.slug}`} className="block h-full rounded-md">
                    <Card interactive className="flex h-full flex-col p-6">
                      <p className="font-display text-h4 text-fg-strong">{service.name}</p>
                      {service.summary ? (
                        <p className="text-fg-secondary mt-3 text-sm">{service.summary}</p>
                      ) : null}
                      <p className="text-accent mt-auto pt-6 font-mono text-xs uppercase">
                        {service.priceFrom === null
                          ? 'On request'
                          : `From ₹${service.priceFrom.toLocaleString('en-IN')}`}
                        {service.durationHours !== null
                          ? ` · ${String(service.durationHours)} hrs`
                          : ''}
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Act 10 - Proof */}
      {settings.homeShowTestimonials && (stats.length > 0 || testimonials.length > 0) ? (
        <Section aria-labelledby="proof-title">
          <Container>
            <ActHeader id="proof-title" eyebrow="Word of mouth" title="What clients say" />

            {stats.length > 0 ? (
              <dl className="border-border mb-14 grid grid-cols-2 gap-8 border-y py-10 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.id} className="text-center">
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="font-display text-h2 text-accent">
                      {Number.isFinite(Number(stat.value)) ? (
                        <CountUp value={Number(stat.value)} suffix={stat.suffix ?? undefined} />
                      ) : (
                        `${stat.value}${stat.suffix ?? ''}`
                      )}
                    </dd>
                    <p className="text-fg-muted mt-2 text-sm">{stat.label}</p>
                  </div>
                ))}
              </dl>
            ) : null}

            {testimonials.length > 0 ? (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {testimonials.map((testimonial) => (
                  <li key={testimonial.id}>
                    {/* No rating stars and no logo wall: the quotes are real but
                        unverified, and the clients are private events. There is
                        nothing truthful to put in either. */}
                    {/* cardClass rather than <Card>, so the element stays a
                        real <blockquote> - the quote's semantics matter more
                        than reusing the wrapper component. */}
                    <blockquote className={cardClass({ className: 'h-full p-6' })}>
                      <p className="text-fg-secondary text-sm">
                        &ldquo;{testimonial.quote}&rdquo;
                      </p>
                      <footer className="text-fg-muted mt-5 font-mono text-xs uppercase">
                        {testimonial.authorName}
                        {testimonial.venueOrEvent ? ` · ${testimonial.venueOrEvent}` : ''}
                      </footer>
                    </blockquote>
                  </li>
                ))}
              </ul>
            ) : null}
          </Container>

          {genreLabels.length > 0 ? <Marquee items={genreLabels} className="mt-16 py-6" /> : null}
        </Section>
      ) : null}

      {/* Act 11 - Book */}
      <Section aria-labelledby="book-title" className="bg-surface/40 relative overflow-hidden">
        <Container className="text-center">
          <h2 id="book-title" className="font-display text-h1 text-fg-strong mx-auto max-w-3xl">
            {settings.homeClosingHeadline ?? 'Ready to experience premium audio?'}
          </h2>
          <p className="text-lead text-fg-secondary mx-auto mt-6 max-w-xl">
            {settings.homeClosingSubheadline ??
              settings.responseTimePromise ??
              'Replies within 24 hours, every time.'}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <MagneticLink href="/book" className={buttonClass({ variant: 'solid', size: 'lg' })}>
              Book now
            </MagneticLink>
            <Link href="/music" className={buttonClass({ variant: 'outline', size: 'lg' })}>
              Listen now
            </Link>
            {settings.contactPhone ? (
              <a
                href={`tel:${settings.contactPhone}`}
                className={buttonClass({ variant: 'ghost', size: 'lg' })}
              >
                {settings.contactPhone}
              </a>
            ) : null}
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

/**
 * Like `SectionHeader`, but the heading carries an id so each act can be a
 * properly labelled landmark via `aria-labelledby`.
 */
function ActHeader({
  id,
  eyebrow,
  title,
  description,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={['mb-10 max-w-2xl', className].filter(Boolean).join(' ')}>
      <p className="text-eyebrow text-accent mb-3 font-semibold tracking-(--text-eyebrow--letter-spacing) uppercase">
        {eyebrow}
      </p>
      <h2 id={id} className="font-display text-h2 text-fg-strong dj-reveal">
        {title}
      </h2>
      {description ? <p className="text-lead text-fg-secondary mt-4">{description}</p> : null}
    </div>
  );
}
