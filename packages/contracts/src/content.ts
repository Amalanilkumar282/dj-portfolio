import { z } from 'zod';

import {
  ContentStatusSchema,
  Id,
  MediaImageSchema,
  PaginationSchema,
  SeoMetaSchema,
  Slug,
  includeSchema,
  inputObject,
  sortSchema,
} from './common.js';

/**
 * Shared content primitives.
 *
 * Every publishable entity carries the same workflow and ordering fields, so
 * they are defined once here. See docs/02-architecture/data-model.md.
 */

/** Fields the admin may set on any publishable entity. */
export const PublishableInput = {
  status: ContentStatusSchema.optional(),
  /**
   * When to publish automatically. The five-minute cron is the single writer
   * of publish state, so this stays DRAFT until it fires.
   */
  scheduledAt: z.coerce.date().nullish(),
  sortIndex: z.number().int().min(0).optional(),
} as const;

/** Fields every publishable entity returns to the admin. */
export const PublishableFields = {
  status: ContentStatusSchema,
  publishedAt: z.coerce.date().nullable(),
  scheduledAt: z.coerce.date().nullable(),
  sortIndex: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
} as const;

/** Bulk reorder. One call, one transaction — drag-and-drop sends a whole permutation. */
export const ReorderInput = inputObject({
  entries: z
    .array(inputObject({ id: Id, sortIndex: z.number().int().min(0) }))
    .min(1)
    .max(500),
});
export type ReorderInput = z.infer<typeof ReorderInput>;

export const ScheduleInput = inputObject({
  publishAt: z.coerce.date(),
});
export type ScheduleInput = z.infer<typeof ScheduleInput>;

// ─────────────────────────────────────────────────────────────────────────────
//  Persona
// ─────────────────────────────────────────────────────────────────────────────

export const PersonaKeySchema = z.enum(['FELICITOUS', 'TRINITROCOSMIC', 'TNT', 'COUPLE_DUO']);

/** Hex colour. CMS-driven per-persona theming; see persona-theming.md. */
export const HexColour = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex colour, e.g. #22D3EE');

export const SocialLinkSchema = z.object({
  platform: z.string(),
  url: z.string().url(),
  handle: z.string().nullable(),
  followerCount: z.number().int().nullable(),
  isPrimary: z.boolean(),
});

export const GenreSummary = z.object({
  slug: Slug,
  name: z.string(),
  isPrimary: z.boolean().optional(),
});

/** What a persona card in a list needs. Deliberately small. */
export const PersonaSummary = z.object({
  id: Id,
  key: PersonaKeySchema,
  slug: Slug,
  stageName: z.string(),
  subtitle: z.string().nullable(),
  shortDescription: z.string().nullable(),
  primaryGenreLabel: z.string().nullable(),
  accentColor: HexColour,
  accentColorSecondary: z.string().nullable(),
  gradientCss: z.string().nullable(),
  isFeatured: z.boolean(),
  isDuo: z.boolean(),
  heroImage: MediaImageSchema.nullable(),
  sortIndex: z.number().int(),
});
export type PersonaSummary = z.infer<typeof PersonaSummary>;

export const PersonaDetail = PersonaSummary.extend({
  // Readable as well as writable. It was writable-only for a while, which
  // means the admin could set a tagline, never see it again, and the public
  // page could not render it — a field that silently goes nowhere. Anything
  // in PersonaCreateBase must be readable somewhere.
  tagline: z.string().nullable(),
  bio: z.string(),
  bioShort: z.string().nullable(),
  memberNames: z.array(z.string()),
  homeCity: z.string().nullable(),
  country: z.string().nullable(),
  bpmRangeLow: z.number().int().nullable(),
  bpmRangeHigh: z.number().int().nullable(),
  yearsActiveFrom: z.number().int().nullable(),
  avatarImage: MediaImageSchema.nullable(),
  genres: z.array(GenreSummary),
  socialLinks: z.array(SocialLinkSchema),
  seo: SeoMetaSchema.nullable(),
});
export type PersonaDetail = z.infer<typeof PersonaDetail>;

/**
 * A persona as the ADMIN sees it.
 *
 * Adds the workflow fields, which the public shape deliberately omits: a
 * visitor has no business knowing a draft exists, while the admin table needs
 * status, publish dates and ordering to render at all.
 */
export const PersonaAdminDetail = PersonaDetail.extend(PublishableFields);
export type PersonaAdminDetail = z.infer<typeof PersonaAdminDetail>;

/**
 * Base shape, named so the refinements below and the partial Update schema can
 * both build on it.
 *
 * Deriving Update via `.innerType()` off a refined schema works but is
 * brittle: adding a refinement silently changes how many unwraps are needed.
 * An explicit base is one more line and cannot rot.
 */
const PersonaCreateBase = inputObject({
  key: PersonaKeySchema,
  slug: Slug.optional(),
  stageName: z.string().min(1).max(120),
  subtitle: z.string().max(160).nullish(),
  tagline: z.string().max(200).nullish(),
  shortDescription: z.string().max(280).nullish(),
  bio: z.string().min(1),
  bioShort: z.string().nullish(),
  primaryGenreLabel: z.string().max(80).nullish(),
  accentColor: HexColour.optional(),
  accentColorSecondary: HexColour.nullish(),
  gradientCss: z.string().max(500).nullish(),
  isFeatured: z.boolean().optional(),
  isDuo: z.boolean().optional(),
  memberNames: z.array(z.string().max(120)).max(10).optional(),
  homeCity: z.string().max(120).nullish(),
  country: z.string().max(120).nullish(),
  bpmRangeLow: z.number().int().min(60).max(300).nullish(),
  bpmRangeHigh: z.number().int().min(60).max(300).nullish(),
  yearsActiveFrom: z.number().int().min(1990).max(2100).nullish(),
  genreSlugs: z.array(Slug).max(30).optional(),
  heroMediaId: Id.nullish(),
  avatarMediaId: Id.nullish(),
  ...PublishableInput,
});

export const PersonaCreateInput = PersonaCreateBase.refine(
  (value) =>
    value.bpmRangeLow == null ||
    value.bpmRangeHigh == null ||
    value.bpmRangeLow <= value.bpmRangeHigh,
  { message: 'The low BPM must not exceed the high BPM.', path: ['bpmRangeLow'] },
);
export type PersonaCreateInput = z.infer<typeof PersonaCreateInput>;

/** Partial, so the admin can PATCH a single field. */
export const PersonaUpdateInput = PersonaCreateBase.partial();
export type PersonaUpdateInput = z.infer<typeof PersonaUpdateInput>;

export const PersonaQuery = PaginationSchema.and(
  z.object({
    featured: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['sortIndex', 'stageName', 'createdAt']).default('sortIndex'),
    include: includeSchema(['genres', 'socialLinks', 'seo']),
  }),
);
export type PersonaQuery = z.infer<typeof PersonaQuery>;

// ─────────────────────────────────────────────────────────────────────────────
//  Genre
// ─────────────────────────────────────────────────────────────────────────────

export const GenreDetail = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  description: z.string().nullable(),
  colorHex: z.string().nullable(),
  sortIndex: z.number().int(),
});
export type GenreDetail = z.infer<typeof GenreDetail>;

export const GenreCreateInput = inputObject({
  slug: Slug.optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
  colorHex: HexColour.nullish(),
  sortIndex: z.number().int().min(0).optional(),
});
export type GenreCreateInput = z.infer<typeof GenreCreateInput>;

export const GenreUpdateInput = GenreCreateInput.partial();
export type GenreUpdateInput = z.infer<typeof GenreUpdateInput>;

/**
 * Genres are a **taxonomy**, not publishable content: no `status`, no
 * `publishedAt`, no `deletedAt`. So there is no publish workflow here and no
 * `genre:publish` permission — see NON_PUBLISHABLE in the RBAC seed.
 *
 * The default limit is 100 rather than 20 because a genre list is a filter
 * control: a paginated one is useless to the caller, who needs every option
 * at once to render it. The set is bounded and small (22 seeded).
 */
export const GenreQuery = z
  .object({
    cursor: z.string().optional(),
    /**
     * Defaults to 100, not `PaginationSchema`'s 20.
     *
     * Written out rather than composed with `PaginationSchema.and(...)`
     * because an intersection cannot override the base default — the 20 wins
     * silently, and the endpoint then truncates the taxonomy while reporting
     * `hasMore: false` only after the caller pages. Overriding a default is a
     * reason not to use `.and()`.
     */
    limit: z.coerce.number().int().min(1).max(100).default(100),
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    q: z.string().max(120).optional(),
    /** Only genres actually attached to published content. */
    inUse: z.coerce.boolean().optional(),
    sort: sortSchema(['sortIndex', 'name', 'createdAt']).default('sortIndex'),
  })
  .refine((v) => !(v.cursor && v.page), {
    message: 'Use either cursor or page, not both',
  });
export type GenreQuery = z.infer<typeof GenreQuery>;

/**
 * The admin view adds usage counts.
 *
 * They are the whole reason deleting a genre is guarded: `PersonaGenre` and
 * `TrackGenre` both cascade, so a hard delete silently strips the tag from
 * every persona and track that used it. The admin needs to see the blast
 * radius *before* clicking.
 */
export const GenreAdminDetail = GenreDetail.extend({
  personaCount: z.number().int(),
  trackCount: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type GenreAdminDetail = z.infer<typeof GenreAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Track
// ─────────────────────────────────────────────────────────────────────────────

export const TrackTypeSchema = z.enum([
  'ORIGINAL',
  'REMIX',
  'LIVE_SET',
  'MIX',
  'PODCAST',
  'COLLABORATION',
]);

export const StreamPlatformSchema = z.enum([
  'SPOTIFY',
  'SOUNDCLOUD',
  'YOUTUBE',
  'APPLE_MUSIC',
  'BEATPORT',
  'BANDCAMP',
  'MIXCLOUD',
  'DEEZER',
  'AMAZON_MUSIC',
]);

export const StreamLinkSchema = z.object({
  platform: StreamPlatformSchema,
  url: z.string().url(),
});

export const TrackSummary = z.object({
  id: Id,
  slug: Slug,
  title: z.string(),
  artistLabel: z.string(),
  type: TrackTypeSchema,
  bpm: z.number().int().nullable(),
  musicalKey: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  releaseDate: z.coerce.date().nullable(),
  isFeatured: z.boolean(),
  artwork: MediaImageSchema.nullable(),
  personaSlug: Slug.nullable(),
  /**
   * Hand-curated, NOT live platform figures.
   *
   * Phase 13 syncs the real counts. Until then these must never be presented
   * as real-time — see docs/07-content/brand.md.
   */
  playCount: z.number().int(),
  likeCount: z.number().int(),
});
export type TrackSummary = z.infer<typeof TrackSummary>;

export const TrackDetail = TrackSummary.extend({
  description: z.string().nullable(),
  soundcloudTrackId: z.string().nullable(),
  embedUrl: z.string().nullable(),
  tags: z.array(z.string()),
  genres: z.array(GenreSummary),
  streamLinks: z.array(StreamLinkSchema),
  /** Precomputed peaks, so a waveform renders without downloading audio. */
  waveformPeaks: z.array(z.number()).nullable(),
  audioUrl: z.string().nullable(),
  seo: SeoMetaSchema.nullable(),
});
export type TrackDetail = z.infer<typeof TrackDetail>;

export const TrackCreateInput = inputObject({
  slug: Slug.optional(),
  title: z.string().min(1).max(200),
  artistLabel: z.string().min(1).max(200),
  personaKey: PersonaKeySchema.nullish(),
  type: TrackTypeSchema.optional(),
  description: z.string().max(2000).nullish(),
  bpm: z.number().int().min(40).max(400).nullish(),
  musicalKey: z.string().max(10).nullish(),
  durationSec: z.number().int().min(0).max(86_400).nullish(),
  releaseDate: z.coerce.date().nullish(),
  isFeatured: z.boolean().optional(),
  soundcloudTrackId: z.string().regex(/^\d+$/, 'Must be numeric.').nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  genreSlugs: z.array(Slug).max(10).optional(),
  streamLinks: z
    .array(inputObject({ platform: StreamPlatformSchema, url: z.string().url() }))
    .max(9)
    .optional(),
  artworkId: Id.nullish(),
  audioId: Id.nullish(),
  ...PublishableInput,
});
export type TrackCreateInput = z.infer<typeof TrackCreateInput>;

export const TrackUpdateInput = TrackCreateInput.partial();
export type TrackUpdateInput = z.infer<typeof TrackUpdateInput>;

export const TrackQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    type: TrackTypeSchema.optional(),
    genreSlug: Slug.optional(),
    featured: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['sortIndex', 'releaseDate', 'title', 'playCount', 'createdAt']).default(
      '-releaseDate',
    ),
    include: includeSchema(['genres', 'streamLinks', 'seo', 'persona']),
  }),
);
export type TrackQuery = z.infer<typeof TrackQuery>;

/** Admin detail adds the publish-workflow fields. */
export const TrackAdminDetail = TrackDetail.extend(PublishableFields);
export type TrackAdminDetail = z.infer<typeof TrackAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Playlist
// ─────────────────────────────────────────────────────────────────────────────

export const PlaylistSummary = z.object({
  id: Id,
  slug: Slug,
  title: z.string(),
  description: z.string().nullable(),
  personaSlug: Slug.nullable(),
  isFeatured: z.boolean(),
  totalDurationSec: z.number().int().nullable(),
  trackCount: z.number().int(),
  cover: MediaImageSchema.nullable(),
});
export type PlaylistSummary = z.infer<typeof PlaylistSummary>;

export const PlaylistDetail = PlaylistSummary.extend({
  tracks: z.array(TrackSummary.extend({ note: z.string().nullable() })),
  seo: SeoMetaSchema.nullable(),
});
export type PlaylistDetail = z.infer<typeof PlaylistDetail>;

export const PlaylistCreateInput = inputObject({
  slug: Slug.optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  personaKey: PersonaKeySchema.nullish(),
  isFeatured: z.boolean().optional(),
  /** Ordered. Position in the array becomes the fractional sort index. */
  trackIds: z.array(Id).max(200).optional(),
  coverId: Id.nullish(),
  ...PublishableInput,
});
export type PlaylistCreateInput = z.infer<typeof PlaylistCreateInput>;

export const PlaylistUpdateInput = PlaylistCreateInput.partial();
export type PlaylistUpdateInput = z.infer<typeof PlaylistUpdateInput>;

export const PlaylistQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    featured: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['sortIndex', 'title', 'createdAt']).default('sortIndex'),
    include: includeSchema(['seo']),
  }),
);
export type PlaylistQuery = z.infer<typeof PlaylistQuery>;

/** Admin detail adds the publish-workflow fields. */
export const PlaylistAdminDetail = PlaylistDetail.extend(PublishableFields);
export type PlaylistAdminDetail = z.infer<typeof PlaylistAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Release
// ─────────────────────────────────────────────────────────────────────────────

export const ReleaseTypeSchema = z.enum(['ALBUM', 'EP', 'SINGLE', 'COMPILATION']);

export const ReleaseSummary = z.object({
  id: Id,
  slug: Slug,
  title: z.string(),
  type: ReleaseTypeSchema,
  artistLabel: z.string(),
  label: z.string().nullable(),
  releaseDate: z.coerce.date().nullable(),
  cover: MediaImageSchema.nullable(),
  personaSlug: Slug.nullable(),
  isFeatured: z.boolean(),
  trackCount: z.number().int(),
});
export type ReleaseSummary = z.infer<typeof ReleaseSummary>;

export const ReleaseDetail = ReleaseSummary.extend({
  description: z.string().nullable(),
  catalogNumber: z.string().nullable(),
  upc: z.string().nullable(),
  tracks: z.array(TrackSummary.extend({ trackNumber: z.number().int().nullable() })),
  streamLinks: z.array(StreamLinkSchema),
  seo: SeoMetaSchema.nullable(),
});
export type ReleaseDetail = z.infer<typeof ReleaseDetail>;

export const ReleaseCreateInput = inputObject({
  slug: Slug.optional(),
  title: z.string().min(1).max(200),
  type: ReleaseTypeSchema.optional(),
  artistLabel: z.string().min(1).max(200),
  personaKey: PersonaKeySchema.nullish(),
  label: z.string().max(120).nullish(),
  catalogNumber: z.string().max(60).nullish(),
  upc: z.string().max(20).nullish(),
  description: z.string().max(4000).nullish(),
  releaseDate: z.coerce.date().nullish(),
  isFeatured: z.boolean().optional(),
  coverId: Id.nullish(),
  ...PublishableInput,
});
export type ReleaseCreateInput = z.infer<typeof ReleaseCreateInput>;

export const ReleaseUpdateInput = ReleaseCreateInput.partial();
export type ReleaseUpdateInput = z.infer<typeof ReleaseUpdateInput>;

export const ReleaseQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    type: ReleaseTypeSchema.optional(),
    featured: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['sortIndex', 'releaseDate', 'title', 'createdAt']).default('-releaseDate'),
    include: includeSchema(['tracks', 'streamLinks', 'seo']),
  }),
);
export type ReleaseQuery = z.infer<typeof ReleaseQuery>;

/** Admin detail adds the publish-workflow fields. */
export const ReleaseAdminDetail = ReleaseDetail.extend(PublishableFields);
export type ReleaseAdminDetail = z.infer<typeof ReleaseAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Venue
// ─────────────────────────────────────────────────────────────────────────────

export const VenueSummary = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  city: z.string(),
  state: z.string().nullable(),
  country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  capacity: z.number().int().nullable(),
  eventCount: z.number().int(),
});
export type VenueSummary = z.infer<typeof VenueSummary>;

export const VenueDetail = VenueSummary.extend({
  addressLine: z.string().nullable(),
  postalCode: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  notes: z.string().nullable(),
  seo: SeoMetaSchema.nullable(),
});
export type VenueDetail = z.infer<typeof VenueDetail>;

export const VenueCreateInput = inputObject({
  slug: Slug.optional(),
  name: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  state: z.string().max(120).nullish(),
  country: z.string().max(120).optional(),
  addressLine: z.string().max(300).nullish(),
  postalCode: z.string().max(20).nullish(),
  // Coordinates drive the gig map and Place structured data.
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  websiteUrl: z.string().url().nullish(),
  instagramUrl: z.string().url().nullish(),
  capacity: z.number().int().min(1).max(500_000).nullish(),
  notes: z.string().max(2000).nullish(),
  // `...PublishableInput` (status, scheduledAt, sortIndex) rather than the
  // hand-written pair this had before: Venue was one of the 6 models missing
  // `scheduledAt` entirely until ADR 0019, and a hand-written field list is
  // exactly how that goes unnoticed a second time.
  ...PublishableInput,
});
export type VenueCreateInput = z.infer<typeof VenueCreateInput>;

export const VenueUpdateInput = VenueCreateInput.partial();
export type VenueUpdateInput = z.infer<typeof VenueUpdateInput>;

export const VenueQuery = PaginationSchema.and(
  z.object({
    city: z.string().max(120).optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['sortIndex', 'name', 'city', 'createdAt']).default('sortIndex'),
    include: includeSchema(['seo']),
  }),
);
export type VenueQuery = z.infer<typeof VenueQuery>;

/** Admin detail adds the publish-workflow fields. */
export const VenueAdminDetail = VenueDetail.extend(PublishableFields);
export type VenueAdminDetail = z.infer<typeof VenueAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Event
// ─────────────────────────────────────────────────────────────────────────────

export const EventKindSchema = z.enum([
  'CLUB',
  'FESTIVAL',
  'WEDDING',
  'CORPORATE',
  'PRIVATE',
  'RADIO',
  'LIVESTREAM',
]);

export const EventStatusSchema = z.enum([
  'ANNOUNCED',
  'CONFIRMED',
  'SOLD_OUT',
  'CANCELLED',
  'POSTPONED',
  'COMPLETED',
]);

export const CurrencySchema = z.enum(['INR', 'USD', 'EUR', 'AED', 'GBP']);

export const LineupSlotSchema = z.object({
  artistName: z.string(),
  role: z.string().nullable(),
  isHeadliner: z.boolean(),
  personaSlug: Slug.nullable(),
});

export const EventSummary = z.object({
  id: Id,
  slug: Slug,
  title: z.string(),
  subtitle: z.string().nullable(),
  kind: EventKindSchema,
  eventStatus: EventStatusSchema,
  /** UTC. Render with `formatIstDateTime`; serialise with `isoWithIstOffset`. */
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  timezone: z.string(),
  isPast: z.boolean(),
  isFeatured: z.boolean(),
  isFree: z.boolean(),
  ticketUrl: z.string().nullable(),
  ticketPriceMin: z.number().nullable(),
  ticketPriceMax: z.number().nullable(),
  currency: CurrencySchema,
  ageRestriction: z.string().nullable(),
  venueName: z.string().nullable(),
  venueSlug: Slug.nullable(),
  city: z.string().nullable(),
  personaSlug: Slug.nullable(),
  flyer: MediaImageSchema.nullable(),
});
export type EventSummary = z.infer<typeof EventSummary>;

export const EventDetail = EventSummary.extend({
  description: z.string().nullable(),
  doorsOpenAt: z.coerce.date().nullable(),
  attendanceEstimate: z.number().int().nullable(),
  venue: VenueSummary.nullable(),
  lineup: z.array(LineupSlotSchema),
  programSlug: Slug.nullable(),
  seo: SeoMetaSchema.nullable(),
});
export type EventDetail = z.infer<typeof EventDetail>;

const EventCreateBase = inputObject({
  slug: Slug.optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).nullish(),
  kind: EventKindSchema.optional(),
  eventStatus: EventStatusSchema.optional(),
  description: z.string().max(4000).nullish(),
  personaKey: PersonaKeySchema.nullish(),
  venueId: Id.nullish(),
  venueNameOverride: z.string().max(200).nullish(),
  cityOverride: z.string().max(120).nullish(),
  countryOverride: z.string().max(120).nullish(),
  programId: Id.nullish(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullish(),
  timezone: z.string().max(60).optional(),
  isAllDay: z.boolean().optional(),
  doorsOpenAt: z.coerce.date().nullish(),
  ticketUrl: z.string().url().nullish(),
  ticketPriceMin: z.number().min(0).nullish(),
  ticketPriceMax: z.number().min(0).nullish(),
  currency: CurrencySchema.optional(),
  isFree: z.boolean().optional(),
  ageRestriction: z.string().max(20).nullish(),
  isFeatured: z.boolean().optional(),
  attendanceEstimate: z.number().int().min(0).nullish(),
  flyerId: Id.nullish(),
  lineup: z
    .array(
      inputObject({
        artistName: z.string().min(1).max(200),
        personaKey: PersonaKeySchema.nullish(),
        role: z.string().max(60).nullish(),
        isHeadliner: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
  ...PublishableInput,
});

export const EventCreateInput = EventCreateBase.refine(
  (v) => v.endsAt == null || v.endsAt >= v.startsAt,
  {
    message: 'An event cannot end before it starts.',
    path: ['endsAt'],
  },
)
  .refine(
    (v) =>
      v.ticketPriceMin == null || v.ticketPriceMax == null || v.ticketPriceMin <= v.ticketPriceMax,
    { message: 'The minimum price must not exceed the maximum.', path: ['ticketPriceMin'] },
  )
  .refine((v) => Boolean(v.venueId) || Boolean(v.venueNameOverride), {
    message: 'Provide either a venue or a one-off venue name.',
    path: ['venueId'],
  });
export type EventCreateInput = z.infer<typeof EventCreateInput>;

/**
 * Partial for PATCH. The cross-field refinements are dropped because a
 * partial update cannot see the fields it would need to compare against —
 * the equivalent CHECK constraints in post-migrate.sql are the backstop.
 */
export const EventUpdateInput = EventCreateBase.partial();
export type EventUpdateInput = z.infer<typeof EventUpdateInput>;

export const EventQuery = PaginationSchema.and(
  z.object({
    when: z.enum(['upcoming', 'past', 'all']).default('all'),
    personaSlug: Slug.optional(),
    venueSlug: Slug.optional(),
    programSlug: Slug.optional(),
    kind: EventKindSchema.optional(),
    city: z.string().max(80).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    featured: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['startsAt', 'title', 'sortIndex', 'createdAt']).default('-startsAt'),
    include: includeSchema(['persona', 'venue', 'lineup', 'seo', 'program']),
  }),
);
export type EventQuery = z.infer<typeof EventQuery>;

/** Admin detail adds the publish-workflow fields. */
export const EventAdminDetail = EventDetail.extend(PublishableFields);
export type EventAdminDetail = z.infer<typeof EventAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Program
// ─────────────────────────────────────────────────────────────────────────────

export const ProgramSummary = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  subtitle: z.string().nullable(),
  cadence: z.string().nullable(),
  isOngoing: z.boolean(),
  personaSlug: Slug.nullable(),
  venueName: z.string().nullable(),
  venueSlug: Slug.nullable(),
  hero: MediaImageSchema.nullable(),
  eventCount: z.number().int(),
});
export type ProgramSummary = z.infer<typeof ProgramSummary>;

export const ProgramDetail = ProgramSummary.extend({
  description: z.string().nullable(),
  residencyFrom: z.coerce.date().nullable(),
  residencyTo: z.coerce.date().nullable(),
  seo: SeoMetaSchema.nullable(),
});
export type ProgramDetail = z.infer<typeof ProgramDetail>;

export const ProgramCreateInput = inputObject({
  slug: Slug.optional(),
  name: z.string().min(1).max(200),
  subtitle: z.string().max(200).nullish(),
  description: z.string().max(4000).nullish(),
  cadence: z.string().max(60).nullish(),
  personaKey: PersonaKeySchema.nullish(),
  venueId: Id.nullish(),
  residencyFrom: z.coerce.date().nullish(),
  residencyTo: z.coerce.date().nullish(),
  isOngoing: z.boolean().optional(),
  heroId: Id.nullish(),
  ...PublishableInput,
});
export type ProgramCreateInput = z.infer<typeof ProgramCreateInput>;

export const ProgramUpdateInput = ProgramCreateInput.partial();
export type ProgramUpdateInput = z.infer<typeof ProgramUpdateInput>;

export const ProgramQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    venueSlug: Slug.optional(),
    ongoing: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['sortIndex', 'name', 'createdAt']).default('sortIndex'),
    include: includeSchema(['seo']),
  }),
);
export type ProgramQuery = z.infer<typeof ProgramQuery>;

/** Admin detail adds the publish-workflow fields. */
export const ProgramAdminDetail = ProgramDetail.extend(PublishableFields);
export type ProgramAdminDetail = z.infer<typeof ProgramAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Persona page aggregate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything a persona landing page needs, in one response.
 *
 * A deliberate backend-for-frontend concession: the alternative is eight
 * round trips per page render, and this keeps the public site at roughly one
 * database query per page. See docs/02-architecture/backend.md.
 */
export const PersonaPageResponse = z.object({
  persona: PersonaDetail,
  featuredTracks: z.array(TrackSummary),
  playlists: z.array(PlaylistSummary),
  upcomingEvents: z.array(EventSummary),
  recentEvents: z.array(EventSummary),
  pastEventCount: z.number().int(),
  programs: z.array(ProgramSummary),
  venuesPlayed: z.array(VenueSummary),
  releases: z.array(ReleaseSummary),
});
export type PersonaPageResponse = z.infer<typeof PersonaPageResponse>;

// ─────────────────────────────────────────────────────────────────────────────
//  Testimonial
// ─────────────────────────────────────────────────────────────────────────────

/**
 * No slug, no detail route: a testimonial is rendered inline on /testimonials
 * and on persona pages, never as its own page. Admin reads/writes by id.
 */
export const TestimonialDetail = z.object({
  id: Id,
  authorName: z.string(),
  authorRole: z.string().nullable(),
  venueOrEvent: z.string().nullable(),
  company: z.string().nullable(),
  quote: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  eventDate: z.coerce.date().nullable(),
  personaSlug: Slug.nullable(),
  avatar: MediaImageSchema.nullable(),
  sourceUrl: z.string().nullable(),
  isFeatured: z.boolean(),
  /** Gates Review/AggregateRating JSON-LD — only real, verified quotes. */
  isVerified: z.boolean(),
});
export type TestimonialDetail = z.infer<typeof TestimonialDetail>;

export const TestimonialCreateInput = inputObject({
  authorName: z.string().min(1).max(160),
  authorRole: z.string().max(160).nullish(),
  venueOrEvent: z.string().max(200).nullish(),
  company: z.string().max(160).nullish(),
  quote: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).nullish(),
  eventDate: z.coerce.date().nullish(),
  personaKey: PersonaKeySchema.nullish(),
  avatarId: Id.nullish(),
  sourceUrl: z.string().url().nullish(),
  isFeatured: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  ...PublishableInput,
});
export type TestimonialCreateInput = z.infer<typeof TestimonialCreateInput>;

export const TestimonialUpdateInput = TestimonialCreateInput.partial();
export type TestimonialUpdateInput = z.infer<typeof TestimonialUpdateInput>;

export const TestimonialQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    featured: z.coerce.boolean().optional(),
    verifiedOnly: z.coerce.boolean().optional(),
    sort: sortSchema(['sortIndex', 'eventDate', 'createdAt']).default('sortIndex'),
  }),
);
export type TestimonialQuery = z.infer<typeof TestimonialQuery>;

export const TestimonialAdminDetail = TestimonialDetail.extend(PublishableFields);
export type TestimonialAdminDetail = z.infer<typeof TestimonialAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Brand
// ─────────────────────────────────────────────────────────────────────────────

export const BrandSummary = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  websiteUrl: z.string().nullable(),
  logo: MediaImageSchema.nullable(),
  logoMono: MediaImageSchema.nullable(),
  category: z.string().nullable(),
  isFeatured: z.boolean(),
  personaSlugs: z.array(Slug),
});
export type BrandSummary = z.infer<typeof BrandSummary>;

export const BrandCreateInput = inputObject({
  slug: Slug.optional(),
  name: z.string().min(1).max(160),
  websiteUrl: z.string().url().nullish(),
  logoId: Id.nullish(),
  logoMonoId: Id.nullish(),
  category: z.string().max(60).nullish(),
  isFeatured: z.boolean().optional(),
  /** Ordered. Position in the array becomes each PersonaBrand's sortIndex. */
  personaKeys: z.array(PersonaKeySchema).max(4).optional(),
  ...PublishableInput,
});
export type BrandCreateInput = z.infer<typeof BrandCreateInput>;

export const BrandUpdateInput = BrandCreateInput.partial();
export type BrandUpdateInput = z.infer<typeof BrandUpdateInput>;

export const BrandQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    featured: z.coerce.boolean().optional(),
    sort: sortSchema(['sortIndex', 'name', 'createdAt']).default('sortIndex'),
  }),
);
export type BrandQuery = z.infer<typeof BrandQuery>;

export const BrandAdminDetail = BrandSummary.extend(PublishableFields);
export type BrandAdminDetail = z.infer<typeof BrandAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Experience (work-experience timeline)
// ─────────────────────────────────────────────────────────────────────────────

export const ExperienceEntryDetail = z.object({
  id: Id,
  role: z.string(),
  organisation: z.string(),
  location: z.string().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  isCurrent: z.boolean(),
  summary: z.string().nullable(),
  highlights: z.array(z.string()),
  logo: MediaImageSchema.nullable(),
});
export type ExperienceEntryDetail = z.infer<typeof ExperienceEntryDetail>;

export const ExperienceEntryCreateInput = inputObject({
  role: z.string().min(1).max(160),
  organisation: z.string().min(1).max(200),
  location: z.string().max(160).nullish(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
  isCurrent: z.boolean().optional(),
  summary: z.string().max(2000).nullish(),
  highlights: z.array(z.string().max(300)).max(20).optional(),
  logoId: Id.nullish(),
  ...PublishableInput,
}).refine((v) => v.endDate == null || v.endDate >= v.startDate, {
  message: 'End date must not be before the start date.',
  path: ['endDate'],
});
export type ExperienceEntryCreateInput = z.infer<typeof ExperienceEntryCreateInput>;

export const ExperienceEntryUpdateInput = inputObject({
  role: z.string().min(1).max(160).optional(),
  organisation: z.string().min(1).max(200).optional(),
  location: z.string().max(160).nullish(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  isCurrent: z.boolean().optional(),
  summary: z.string().max(2000).nullish(),
  highlights: z.array(z.string().max(300)).max(20).optional(),
  logoId: Id.nullish(),
  ...PublishableInput,
});
export type ExperienceEntryUpdateInput = z.infer<typeof ExperienceEntryUpdateInput>;

export const ExperienceEntryQuery = PaginationSchema.and(
  z.object({
    current: z.coerce.boolean().optional(),
    sort: sortSchema(['startDate', 'sortIndex', 'createdAt']).default('-startDate'),
  }),
);
export type ExperienceEntryQuery = z.infer<typeof ExperienceEntryQuery>;

export const ExperienceEntryAdminDetail = ExperienceEntryDetail.extend(PublishableFields);
export type ExperienceEntryAdminDetail = z.infer<typeof ExperienceEntryAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Gear
// ─────────────────────────────────────────────────────────────────────────────

export const GearCategorySchema = z.enum([
  'MIXER',
  'CDJ',
  'CONTROLLER',
  'TURNTABLE',
  'DAW',
  'MONITOR',
  'SOFTWARE',
  'OUTBOARD',
  'MICROPHONE',
  'LIGHTING',
]);
export type GearCategory = z.infer<typeof GearCategorySchema>;

export const ProficiencyLevelSchema = z.enum(['FAMILIAR', 'PROFICIENT', 'ADVANCED', 'EXPERT']);
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;

export const GearItemDetail = z.object({
  id: Id,
  slug: Slug,
  category: GearCategorySchema,
  brand: z.string(),
  model: z.string(),
  proficiency: ProficiencyLevelSchema,
  yearsUsed: z.number().int().nullable(),
  notes: z.string().nullable(),
  isRiderItem: z.boolean(),
  isPreferred: z.boolean(),
  image: MediaImageSchema.nullable(),
});
export type GearItemDetail = z.infer<typeof GearItemDetail>;

export const GearItemCreateInput = inputObject({
  slug: Slug.optional(),
  category: GearCategorySchema,
  brand: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  proficiency: ProficiencyLevelSchema.optional(),
  yearsUsed: z.number().int().min(0).max(60).nullish(),
  notes: z.string().max(2000).nullish(),
  isRiderItem: z.boolean().optional(),
  isPreferred: z.boolean().optional(),
  imageId: Id.nullish(),
  ...PublishableInput,
});
export type GearItemCreateInput = z.infer<typeof GearItemCreateInput>;

export const GearItemUpdateInput = GearItemCreateInput.partial();
export type GearItemUpdateInput = z.infer<typeof GearItemUpdateInput>;

export const GearItemQuery = PaginationSchema.and(
  z.object({
    category: GearCategorySchema.optional(),
    riderOnly: z.coerce.boolean().optional(),
    sort: sortSchema(['sortIndex', 'brand', 'createdAt']).default('sortIndex'),
  }),
);
export type GearItemQuery = z.infer<typeof GearItemQuery>;

export const GearItemAdminDetail = GearItemDetail.extend(PublishableFields);
export type GearItemAdminDetail = z.infer<typeof GearItemAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Service
// ─────────────────────────────────────────────────────────────────────────────

export const ServiceCategorySchema = z.enum([
  'WEDDING',
  'CORPORATE',
  'CLUB',
  'FESTIVAL',
  'PRIVATE_PARTY',
  'PRODUCTION',
]);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const ServiceSummary = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  category: ServiceCategorySchema,
  summary: z.string().nullable(),
  durationHours: z.number().int().nullable(),
  priceFrom: z.number().nullable(),
  priceTo: z.number().nullable(),
  currency: CurrencySchema,
  personaSlug: Slug.nullable(),
  image: MediaImageSchema.nullable(),
  isFeatured: z.boolean(),
});
export type ServiceSummary = z.infer<typeof ServiceSummary>;

export const ServiceDetail = ServiceSummary.extend({
  description: z.string().nullable(),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  addons: z.array(z.string()),
  seo: SeoMetaSchema.nullable(),
});
export type ServiceDetail = z.infer<typeof ServiceDetail>;

export const ServiceCreateInput = inputObject({
  slug: Slug.optional(),
  name: z.string().min(1).max(200),
  category: ServiceCategorySchema,
  summary: z.string().max(280).nullish(),
  description: z.string().max(5000).nullish(),
  inclusions: z.array(z.string().max(200)).max(30).optional(),
  exclusions: z.array(z.string().max(200)).max(30).optional(),
  addons: z.array(z.string().max(200)).max(30).optional(),
  durationHours: z.number().int().min(1).max(72).nullish(),
  priceFrom: z.number().min(0).max(100_000_000).nullish(),
  priceTo: z.number().min(0).max(100_000_000).nullish(),
  currency: CurrencySchema.optional(),
  personaKey: PersonaKeySchema.nullish(),
  imageId: Id.nullish(),
  isFeatured: z.boolean().optional(),
  ...PublishableInput,
});
export type ServiceCreateInput = z.infer<typeof ServiceCreateInput>;

export const ServiceUpdateInput = ServiceCreateInput.partial();
export type ServiceUpdateInput = z.infer<typeof ServiceUpdateInput>;

export const ServiceQuery = PaginationSchema.and(
  z.object({
    category: ServiceCategorySchema.optional(),
    personaSlug: Slug.optional(),
    featured: z.coerce.boolean().optional(),
    sort: sortSchema(['sortIndex', 'name', 'createdAt']).default('sortIndex'),
    include: includeSchema(['seo']),
  }),
);
export type ServiceQuery = z.infer<typeof ServiceQuery>;

export const ServiceAdminDetail = ServiceDetail.extend(PublishableFields);
export type ServiceAdminDetail = z.infer<typeof ServiceAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Faq
// ─────────────────────────────────────────────────────────────────────────────

export const FaqDetail = z.object({
  id: Id,
  slug: Slug,
  question: z.string(),
  /** Plain text only: FAQPage JSON-LD must not carry nested markup. */
  answer: z.string(),
  category: z.string().nullable(),
  personaSlug: Slug.nullable(),
  serviceSlug: Slug.nullable(),
});
export type FaqDetail = z.infer<typeof FaqDetail>;

export const FaqCreateInput = inputObject({
  slug: Slug.optional(),
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(5000),
  category: z.string().max(60).nullish(),
  personaKey: PersonaKeySchema.nullish(),
  serviceId: Id.nullish(),
  ...PublishableInput,
});
export type FaqCreateInput = z.infer<typeof FaqCreateInput>;

export const FaqUpdateInput = FaqCreateInput.partial();
export type FaqUpdateInput = z.infer<typeof FaqUpdateInput>;

export const FaqQuery = PaginationSchema.and(
  z.object({
    category: z.string().max(60).optional(),
    personaSlug: Slug.optional(),
    serviceSlug: Slug.optional(),
    sort: sortSchema(['sortIndex', 'createdAt']).default('sortIndex'),
  }),
);
export type FaqQuery = z.infer<typeof FaqQuery>;

export const FaqAdminDetail = FaqDetail.extend(PublishableFields);
export type FaqAdminDetail = z.infer<typeof FaqAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Static pages
// ─────────────────────────────────────────────────────────────────────────────

export const StaticPageDetail = z.object({
  id: Id,
  slug: Slug,
  title: z.string(),
  /** Tiptap JSON, opaque to the contract — rendered through a typed RichText component. */
  content: z.unknown(),
  lastReviewedAt: z.coerce.date().nullable(),
  seo: SeoMetaSchema.nullable(),
});
export type StaticPageDetail = z.infer<typeof StaticPageDetail>;

export const StaticPageCreateInput = inputObject({
  slug: Slug.optional(),
  title: z.string().min(1).max(200),
  content: z.unknown(),
  contentText: z.string().max(50_000).nullish(),
  lastReviewedAt: z.coerce.date().nullish(),
  status: ContentStatusSchema.optional(),
  scheduledAt: z.coerce.date().nullish(),
});
export type StaticPageCreateInput = z.infer<typeof StaticPageCreateInput>;

export const StaticPageUpdateInput = StaticPageCreateInput.partial();
export type StaticPageUpdateInput = z.infer<typeof StaticPageUpdateInput>;

export const StaticPageQuery = PaginationSchema.and(z.object({}));
export type StaticPageQuery = z.infer<typeof StaticPageQuery>;

/**
 * `StaticPage` has no `sortIndex` column, unlike every other publishable
 * model — it is never drag-reordered — so the admin shape omits it rather
 * than extending `PublishableFields` wholesale.
 */
export const StaticPageAdminDetail = StaticPageDetail.extend({
  status: ContentStatusSchema,
  publishedAt: z.coerce.date().nullable(),
  scheduledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type StaticPageAdminDetail = z.infer<typeof StaticPageAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Press kit
// ─────────────────────────────────────────────────────────────────────────────

export const PressAssetKindSchema = z.enum([
  'LOGO_PACK',
  'LOGO_SVG',
  'HI_RES_PHOTO',
  'TECH_RIDER',
  'STAGE_PLOT',
  'BIO_PDF',
  'EPK_PDF',
  'RIDER_HOSPITALITY',
]);
export type PressAssetKind = z.infer<typeof PressAssetKindSchema>;

export const PressAssetDetail = z.object({
  id: Id,
  kind: PressAssetKindSchema,
  title: z.string(),
  description: z.string().nullable(),
  media: MediaImageSchema.nullable(),
  /** Set only when `requiresEmail` and a valid request has been made — see the download endpoint. */
  downloadUrl: z.string().nullable(),
  personaSlug: Slug.nullable(),
  version: z.number().int(),
  requiresEmail: z.boolean(),
});
export type PressAssetDetail = z.infer<typeof PressAssetDetail>;

export const PressAssetCreateInput = inputObject({
  kind: PressAssetKindSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullish(),
  mediaId: Id.nullish(),
  personaKey: PersonaKeySchema.nullish(),
  requiresEmail: z.boolean().optional(),
  ...PublishableInput,
});
export type PressAssetCreateInput = z.infer<typeof PressAssetCreateInput>;

export const PressAssetUpdateInput = PressAssetCreateInput.partial();
export type PressAssetUpdateInput = z.infer<typeof PressAssetUpdateInput>;

export const PressAssetQuery = PaginationSchema.and(
  z.object({
    kind: PressAssetKindSchema.optional(),
    personaSlug: Slug.optional(),
    sort: sortSchema(['sortIndex', 'createdAt']).default('sortIndex'),
  }),
);
export type PressAssetQuery = z.infer<typeof PressAssetQuery>;

export const PressAssetAdminDetail = PressAssetDetail.extend(PublishableFields).extend({
  downloadCount: z.number().int(),
});
export type PressAssetAdminDetail = z.infer<typeof PressAssetAdminDetail>;

/** Requesting a gated download: email required so it can be recorded and rate-limited. */
export const PressAssetDownloadInput = inputObject({
  email: z.string().email().optional(),
});
export type PressAssetDownloadInput = z.infer<typeof PressAssetDownloadInput>;

// ─────────────────────────────────────────────────────────────────────────────
//  Blog (Post + Tag)
// ─────────────────────────────────────────────────────────────────────────────

export const TagDetail = z.object({
  id: Id,
  slug: Slug,
  name: z.string(),
  description: z.string().nullable(),
});
export type TagDetail = z.infer<typeof TagDetail>;

export const TagCreateInput = inputObject({
  slug: Slug.optional(),
  name: z.string().min(1).max(60),
  description: z.string().max(300).nullish(),
});
export type TagCreateInput = z.infer<typeof TagCreateInput>;

export const TagUpdateInput = TagCreateInput.partial();
export type TagUpdateInput = z.infer<typeof TagUpdateInput>;

export const TagQuery = z.object({
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
export type TagQuery = z.infer<typeof TagQuery>;

export const TagAdminDetail = TagDetail.extend({
  postCount: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TagAdminDetail = z.infer<typeof TagAdminDetail>;

export const PostSummary = z.object({
  id: Id,
  slug: Slug,
  title: z.string(),
  excerpt: z.string().nullable(),
  readingMinutes: z.number().int().nullable(),
  cover: MediaImageSchema.nullable(),
  personaSlug: Slug.nullable(),
  authorName: z.string().nullable(),
  isFeatured: z.boolean(),
  publishedAt: z.coerce.date().nullable(),
  tags: z.array(TagDetail),
});
export type PostSummary = z.infer<typeof PostSummary>;

export const PostDetail = PostSummary.extend({
  /** Tiptap JSON, opaque to the contract. */
  content: z.unknown(),
  seo: SeoMetaSchema.nullable(),
});
export type PostDetail = z.infer<typeof PostDetail>;

export const PostCreateInput = inputObject({
  slug: Slug.optional(),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(400).nullish(),
  content: z.unknown(),
  contentText: z.string().max(200_000).nullish(),
  readingMinutes: z.number().int().min(1).max(120).nullish(),
  coverId: Id.nullish(),
  personaKey: PersonaKeySchema.nullish(),
  authorName: z.string().max(120).nullish(),
  isFeatured: z.boolean().optional(),
  tagSlugs: z.array(Slug).max(10).optional(),
  ...PublishableInput,
});
export type PostCreateInput = z.infer<typeof PostCreateInput>;

export const PostUpdateInput = PostCreateInput.partial();
export type PostUpdateInput = z.infer<typeof PostUpdateInput>;

export const PostQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    tagSlug: Slug.optional(),
    featured: z.coerce.boolean().optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['publishedAt', 'title', 'createdAt']).default('-publishedAt'),
    include: includeSchema(['seo']),
  }),
);
export type PostQuery = z.infer<typeof PostQuery>;

export const PostAdminDetail = PostDetail.extend(PublishableFields);
export type PostAdminDetail = z.infer<typeof PostAdminDetail>;
