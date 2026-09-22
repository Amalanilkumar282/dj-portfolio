import { type ContentChangedEvent, type RevalidatableEntity, tags } from '@dj/contracts';

/**
 * Entity to cache-tag mapping.
 *
 * ## This must stay symmetrical with the web app
 *
 * `packages/contracts/src/cache-tags.ts` defines the tag vocabulary and the
 * web app's query modules attach those tags when they fetch. This file decides
 * which of them to invalidate when something changes.
 *
 * **An asymmetry here does not fail any test.** It fails silently as
 * "I published but nothing changed" — the single most confusing bug this
 * system can produce, because every individual piece looks correct. If you add
 * a tag to a query module, add it here in the same change.
 *
 * The rule for each entity: its own tag, its aggregate list, `sitemap`, and
 * the owning persona's page if it belongs to one.
 *
 * See docs/02-architecture/caching-and-revalidation.md
 */
type TagResolver = (event: ContentChangedEvent) => (string | undefined)[];

const TAG_MAP: Record<RevalidatableEntity, TagResolver> = {
  persona: (e) => [
    tags.personas,
    e.slug ? tags.persona(e.slug) : undefined,
    // A persona rename changes the nav and every breadcrumb.
    tags.nav,
    tags.home,
    tags.sitemap,
  ],

  /**
   * A genre has no page of its own yet — it is rendered as a filter control
   * on /music and as chips on every persona page. So a rename has to reach
   * both aggregates, or the old label keeps showing indefinitely on
   * statically-rendered pages.
   */
  genre: (e) => [
    tags.genres,
    e.slug ? tags.genre(e.slug) : undefined,
    tags.tracks,
    tags.personas,
    tags.sitemap,
  ],

  track: (e) => [
    tags.tracks,
    e.slug ? tags.track(e.slug) : undefined,
    tags.tracksFeatured,
    e.personaSlug ? tags.tracksByPersona(e.personaSlug) : undefined,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    // A track can belong to a playlist, and the playlist page renders its
    // title and duration.
    tags.playlists,
    tags.sitemap,
  ],

  playlist: (e) => [
    tags.playlists,
    e.slug ? tags.playlist(e.slug) : undefined,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    tags.sitemap,
  ],

  release: (e) => [
    tags.releases,
    e.slug ? tags.release(e.slug) : undefined,
    tags.tracks,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    tags.sitemap,
  ],

  event: (e) => [
    // Both, because publishing an event or flipping isPast moves it between
    // the two lists and we cannot tell which direction from here.
    tags.eventsUpcoming,
    tags.eventsPast,
    e.slug ? tags.event(e.slug) : undefined,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    // The home page streams the next three gigs.
    tags.home,
    tags.venues,
    tags.programs,
    tags.sitemap,
  ],

  program: (e) => [
    tags.programs,
    e.slug ? tags.program(e.slug) : undefined,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    tags.sitemap,
  ],

  venue: (e) => [
    tags.venues,
    e.slug ? tags.venue(e.slug) : undefined,
    // Event pages render the venue name and its map position.
    tags.eventsUpcoming,
    tags.eventsPast,
    // The homepage lists the rooms he has played.
    tags.home,
    tags.sitemap,
  ],

  gallery: (e) => [
    tags.gallery,
    e.slug ? tags.galleryBySlug(e.slug) : undefined,
    e.personaSlug ? tags.galleryByPersona(e.personaSlug) : undefined,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    // The homepage carries a gallery rail.
    tags.home,
    tags.sitemap,
  ],

  video: (e) => [
    tags.videos,
    e.slug ? tags.video(e.slug) : undefined,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    // The homepage carries a video rail.
    tags.home,
    tags.sitemap,
  ],

  testimonial: (e) => [
    tags.testimonials,
    e.personaSlug ? tags.persona(e.personaSlug) : undefined,
    tags.home,
  ],

  service: (e) => [
    tags.services,
    e.slug ? tags.service(e.slug) : undefined,
    tags.home,
    tags.sitemap,
  ],

  faq: () => [tags.faqs, tags.services, tags.sitemap],
  gear: () => [tags.gear, tags.sitemap],
  experience: () => [tags.experience, tags.sitemap],
  brand: () => [tags.brands, tags.home],
  stat: (e) => [tags.stats, tags.home, e.personaSlug ? tags.persona(e.personaSlug) : undefined],
  pressAsset: () => [tags.pressKit, tags.sitemap],

  post: (e) => [tags.posts, e.slug ? tags.post(e.slug) : undefined, tags.sitemap],

  staticPage: (e) => [e.slug ? tags.page(e.slug) : undefined, tags.sitemap],

  // Settings touch the header, footer and default SEO on every page, so this
  // is the one entity that legitimately invalidates broadly.
  settings: () => [tags.settings, tags.nav, tags.footer, tags.home, tags.sitemap],

  // Redirects are read by the web middleware, which caches them for an hour.
  redirect: () => [tags.settings],
};

/** Resolves the tags to invalidate for a change. Deduplicated and sorted. */
export function resolveTags(event: ContentChangedEvent): string[] {
  // Looked up as possibly-missing on purpose. `event.entity` is typed as the
  // union, but the event crosses a process boundary, so at runtime it can be
  // any string. Falling back to the sitemap keeps a new entity from throwing
  // while the tag-map spec fails loudly for the missing case.
  const resolver = (TAG_MAP as Record<string, TagResolver | undefined>)[event.entity];
  if (!resolver) return [tags.sitemap];

  return [...new Set(resolver(event).filter((tag): tag is string => Boolean(tag)))].sort();
}
