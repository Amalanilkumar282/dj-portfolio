import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonClass, Chip } from '@dj/ui/primitives';

import type { Channel } from '../../components/cinematic/channel-switcher';
import { StageBackdrop } from '../../components/cinematic/stage-backdrop';
import { StageProvider } from '../../components/cinematic/stage-context';
import { Container, Section } from '../../components/container';
import { ChannelAct } from '../../components/home/channel-act';
import { CountUp } from '../../components/home/count-up';
import { DeckAct } from '../../components/home/deck-act';
import { GigMap, type MapVenue } from '../../components/home/gig-map';
import { Marquee } from '../../components/home/marquee';
import { TrackWall, type WallTrack } from '../../components/home/track-wall';
import { MagneticLink } from '../../components/magnetic-link';
import { JsonLd, type JsonLdNode } from '../../lib/json-ld';
import { absoluteUrl, SITE } from '../../lib/site';
import { getGear } from '../../server/queries/gear';
import { getPersona, getPersonas } from '../../server/queries/personas';
import { getPrograms } from '../../server/queries/programs';
import { getServices } from '../../server/queries/services';
import { getSettings } from '../../server/queries/settings';
import { getStats } from '../../server/queries/stats';
import { getTestimonials } from '../../server/queries/testimonials';
import { getTracks } from '../../server/queries/tracks';
import { getVenues } from '../../server/queries/venues';

/**
 * The homepage is the site.
 *
 * Most promoters never open a second page, so every area of the site is
 * represented here with **real content**, not a teaser: the whole catalogue
 * is playable in place, the residencies are the real weekly nights, the map
 * pins are the venues' real coordinates. Nine acts, one continuous scroll.
 *
 * This file stays a Server Component (`dj/no-client-in-route-files`). The
 * heavy visuals are six client islands, every one lazy and gated: the stage
 * backdrop, the channel switcher, the track wall, the deck, the map and the
 * counters. Nothing autoplays sound, and no island is the only route to a
 * piece of information.
 *
 * There is deliberately **no "upcoming shows" section**: the catalogue has
 * zero events because no real gig dates existed to seed, and the honest —
 * and stronger — story is the standing residencies. See
 * docs/07-content/brand.md.
 */

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
  openGraph: { url: absoluteUrl('/'), type: 'website' },
};

export default async function HomePage(): Promise<React.JSX.Element> {
  const [personaSummaries, tracks, venues, programs, services, stats, testimonials, gear, settings] =
    await Promise.all([
      getPersonas(),
      getTracks(),
      getVenues(),
      getPrograms(),
      getServices(),
      getStats(),
      getTestimonials({ limit: 6 }),
      getGear(),
      getSettings(),
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

  // Bengaluru first: the map draws its arcs outward from the first pin, and
  // that is where five of the seven venues actually are.
  const mapVenues: MapVenue[] = venues
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
    }))
    .sort((a, b) => Number(b.city === 'Bengaluru') - Number(a.city === 'Bengaluru'));

  const cityCount = new Set(mapVenues.map((venue) => venue.city)).size;

  const genreLabels = [
    ...new Set(personas.flatMap((persona) => persona.genres.map((genre) => genre.name))),
  ];

  const residencies = programs.filter((program) => program.isOngoing);
  const liveResidency = residencies[0] ?? programs[0] ?? null;

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
            Bengaluru · India
          </p>

          {/* One accessible string. The mask reveal animates spans inside the
              heading; the heading is never split into separate elements. */}
          <h1
            id="hero-title"
            className="font-display text-display text-fg-strong dj-rise-mask mt-4 max-w-5xl"
          >
            <span>One artist.</span> <span className="text-accent">Four sounds.</span>
          </h1>

          <p className="text-lead text-fg-secondary dj-reveal mt-8 max-w-xl">
            {SITE.defaultDescription}
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <MagneticLink href="/book" className={buttonClass({ variant: 'solid', size: 'lg' })}>
              Book an event
            </MagneticLink>
            <Link href="#sound" className={buttonClass({ variant: 'outline', size: 'lg' })}>
              Hear the sound
            </Link>
          </div>

          <dl className="text-fg-muted mt-14 flex flex-wrap gap-x-10 gap-y-4 font-mono text-xs uppercase">
            <Fact label="Channels" value={String(personas.length)} />
            <Fact label="Tracks" value={String(tracks.length)} />
            <Fact label="Residencies" value={String(residencies.length)} />
            <Fact label="Venues" value={String(venues.length)} />
          </dl>
        </Container>
      </section>

      {/* Act 2 - The channel switcher */}
      <Section aria-labelledby="channels-title" className="relative">
        <Container>
          <ActHeader
            id="channels-title"
            eyebrow="Tune in"
            title="Four channels, one artist"
            description="Each identity has its own sound, its own tempo and its own colour. Pick one and the whole site retunes to it."
          />
          <ChannelAct channels={channels} />
        </Container>
      </Section>

      {/* Act 3 - Sound */}
      <Section id="sound" aria-labelledby="sound-title" className="bg-surface/40">
        <Container>
          <ActHeader
            id="sound-title"
            eyebrow="Sound"
            title={`${String(tracks.length)} tracks, playable right here`}
            description="Everything plays in place, and keeps playing while you move around the site."
          />
          <TrackWall
            tracks={wallTracks}
            personas={personas.map((persona) => ({
              slug: persona.slug,
              stageName: persona.stageName,
            }))}
          />
        </Container>
      </Section>

      {/* Act 4 - The deck. Hidden below lg: a drag-to-scrub platter has no
          meaning on a touch screen, and the 3D budget is desktop-gated. */}
      <Section aria-labelledby="deck-title" className="hidden lg:block">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <ActHeader
              id="deck-title"
              eyebrow="The rig"
              title="Take the deck"
              description="Built from geometry, driven by whatever is actually playing. Drag across the platter to scrub."
            />
            <Marquee
              items={gear.slice(0, 8).map((item) => `${item.brand} ${item.model}`)}
              className="mt-2"
            />
          </div>
          <DeckAct />
        </Container>
      </Section>

      {/* Act 5 - Where I play */}
      <Section aria-labelledby="map-title">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <ActHeader
              id="map-title"
              eyebrow="On the road"
              title="Where the nights happen"
              description={`${String(mapVenues.length)} rooms across ${String(cityCount)} cities - clubs, resorts and private estates.`}
            />
            <Link href="/venues" className={buttonClass({ variant: 'ghost', size: 'md' })}>
              All venues
            </Link>
          </div>
          <GigMap venues={mapVenues} />
        </Container>
      </Section>

      {/* Act 6 - Residencies */}
      {residencies.length > 0 ? (
        <Section aria-labelledby="residencies-title" className="bg-surface/40">
          <Container>
            <ActHeader
              id="residencies-title"
              eyebrow="Standing nights"
              title="Residencies"
              description="Not one-off bookings. These run every week."
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {residencies.map((program) => (
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

      {/* Act 7 - What I do */}
      {services.length > 0 ? (
        <Section aria-labelledby="services-title">
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
                  <Link
                    href={`/services/${service.slug}`}
                    className="border-border hover-hover:hover:border-accent flex h-full flex-col rounded-md border p-6 transition-[border-color] duration-(--duration-fast)"
                  >
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
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Act 8 - Proof and rig */}
      <Section aria-labelledby="proof-title" className="bg-surface/40">
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
                  <blockquote className="border-border h-full rounded-md border p-6">
                    <p className="text-fg-secondary text-sm">&ldquo;{testimonial.quote}&rdquo;</p>
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

      {/* Act 9 - Book */}
      <Section aria-labelledby="book-title" className="relative overflow-hidden">
        <Container className="text-center">
          <h2 id="book-title" className="font-display text-h1 text-fg-strong mx-auto max-w-3xl">
            Tell me about the night.
          </h2>
          <p className="text-lead text-fg-secondary mx-auto mt-6 max-w-xl">
            Replies within 24 hours, every time.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <MagneticLink href="/book" className={buttonClass({ variant: 'solid', size: 'lg' })}>
              Start a booking
            </MagneticLink>
            {settings.contactPhone ? (
              <a
                href={`tel:${settings.contactPhone}`}
                className={buttonClass({ variant: 'outline', size: 'lg' })}
              >
                {settings.contactPhone}
              </a>
            ) : null}
            <a
              href={`mailto:${settings.contactEmail}`}
              className={buttonClass({ variant: 'ghost', size: 'lg' })}
            >
              {settings.contactEmail}
            </a>
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
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
}): React.JSX.Element {
  return (
    <div className="mb-10 max-w-2xl">
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
