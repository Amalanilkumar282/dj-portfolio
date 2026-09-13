/**
 * Cache-tag taxonomy.
 *
 * This is one half of a two-sided contract. The API mirrors it in
 * `RevalidationService`'s TAG_MAP, so that when content changes the API can
 * name exactly the tags the web app attached when it fetched that content.
 *
 * **The two must stay symmetrical.** An asymmetry does not fail any test — it
 * fails silently as "I published but nothing changed", which is the single
 * most confusing bug this system can have.
 *
 * Rules:
 *  - Query modules own their tags. Pages never pass tag strings themselves;
 *    a page that hand-writes one is a page that gets forgotten when the tag
 *    changes.
 *  - Entity tags are `entity:slug`. Aggregate tags are bare.
 *  - Mutating an entity invalidates its own tag, its aggregate, and
 *    `sitemap`.
 *
 * See docs/02-architecture/caching-and-revalidation.md
 */

export const tags = {
  /** Nuclear option, used only by the weekly revalidate-all backstop. */
  all: 'all',

  home: 'home',
  nav: 'nav',
  footer: 'footer',
  settings: 'settings',
  sitemap: 'sitemap',

  personas: 'personas',
  persona: (slug: string) => `persona:${slug}`,

  /**
   * Genres are a taxonomy, so a change to one is felt wherever it is
   * *rendered*, not on a page of its own: the filter bar on /music, and the
   * genre chips on every persona page. Renaming "Psytrance" has to reach
   * those, which is why `genre` invalidates `tracks` and `personas` too.
   */
  genres: 'genres',
  genre: (slug: string) => `genre:${slug}`,

  tracks: 'tracks',
  track: (slug: string) => `track:${slug}`,
  tracksFeatured: 'tracks:featured',
  tracksByPersona: (slug: string) => `tracks:persona:${slug}`,

  playlists: 'playlists',
  playlist: (slug: string) => `playlist:${slug}`,

  releases: 'releases',
  release: (slug: string) => `release:${slug}`,

  /** Split, because the upcoming list revalidates far more often than the archive. */
  eventsUpcoming: 'events:upcoming',
  eventsPast: 'events:past',
  event: (slug: string) => `event:${slug}`,

  programs: 'programs',
  program: (slug: string) => `program:${slug}`,

  venues: 'venues',
  venue: (slug: string) => `venue:${slug}`,

  gallery: 'gallery',
  galleryBySlug: (slug: string) => `gallery:${slug}`,
  galleryByPersona: (slug: string) => `gallery:persona:${slug}`,

  videos: 'videos',
  video: (slug: string) => `video:${slug}`,

  testimonials: 'testimonials',
  services: 'services',
  service: (slug: string) => `service:${slug}`,
  faqs: 'faqs',
  gear: 'gear',
  experience: 'experience',
  brands: 'brands',
  stats: 'stats',
  pressKit: 'press-kit',

  posts: 'posts',
  post: (slug: string) => `post:${slug}`,
  postsByTag: (slug: string) => `posts:tag:${slug}`,

  page: (slug: string) => `page:${slug}`,
} as const;

/** Entity names the revalidation webhook accepts. */
export const REVALIDATABLE_ENTITIES = [
  'persona',
  'genre',
  'track',
  'playlist',
  'release',
  'event',
  'program',
  'venue',
  'gallery',
  'video',
  'testimonial',
  'service',
  'faq',
  'gear',
  'experience',
  'brand',
  'stat',
  'pressAsset',
  'post',
  'staticPage',
  'settings',
  'redirect',
] as const;

export type RevalidatableEntity = (typeof REVALIDATABLE_ENTITIES)[number];

/** Payload of the api -> web revalidation webhook. */
export interface RevalidatePayload {
  tags: string[];
  paths?: string[];
}

/** Domain event the API emits on any content mutation. */
export interface ContentChangedEvent {
  entity: RevalidatableEntity;
  id: string;
  slug?: string | undefined;
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'archive' | 'restore';
  /** Set when the entity belongs to a persona, so its page is invalidated too. */
  personaSlug?: string | undefined;
}
