import { z } from 'zod';

import {
  Id,
  MediaImageSchema,
  PaginationSchema,
  Slug,
  inputObject,
  sortSchema,
} from './common.js';
import { PersonaKeySchema } from './content.js';

/**
 * Site-wide, non-content models: stat counters, the settings singleton and
 * legacy URL redirects. None of these are publishable content, so none
 * extend `PublishableFields` — see docs/02-architecture/backend.md
 * §"Adding a content module" for the taxonomy-vs-publishable distinction.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Stat
// ─────────────────────────────────────────────────────────────────────────────

export const StatDetail = z.object({
  id: Id,
  key: z.string(),
  label: z.string(),
  /** String so "10M+" renders verbatim; see `numericValue` for the animation target. */
  value: z.string(),
  numericValue: z.number().nullable(),
  unit: z.string().nullable(),
  suffix: z.string().nullable(),
  icon: z.string().nullable(),
  personaSlug: Slug.nullable(),
  isVisible: z.boolean(),
  sortIndex: z.number().int(),
});
export type StatDetail = z.infer<typeof StatDetail>;

export const StatCreateInput = inputObject({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Must be lowercase snake_case, e.g. gigs_played'),
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(40),
  numericValue: z.number().nullish(),
  unit: z.string().max(20).nullish(),
  suffix: z.string().max(10).nullish(),
  icon: z.string().max(60).nullish(),
  personaKey: PersonaKeySchema.nullish(),
  isVisible: z.boolean().optional(),
  sortIndex: z.number().int().min(0).optional(),
});
export type StatCreateInput = z.infer<typeof StatCreateInput>;

export const StatUpdateInput = StatCreateInput.partial();
export type StatUpdateInput = z.infer<typeof StatUpdateInput>;

export const StatQuery = PaginationSchema.and(
  z.object({
    personaSlug: Slug.optional(),
    visibleOnly: z.coerce.boolean().optional(),
    sort: sortSchema(['sortIndex', 'createdAt']).default('sortIndex'),
  }),
);
export type StatQuery = z.infer<typeof StatQuery>;

export const StatAdminDetail = StatDetail.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type StatAdminDetail = z.infer<typeof StatAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Site settings (singleton)
// ─────────────────────────────────────────────────────────────────────────────

export const SiteSettingsDetail = z.object({
  siteName: z.string(),
  siteTagline: z.string().nullable(),
  logo: MediaImageSchema.nullable(),
  /** An optional looping muted clip behind the homepage hero. */
  homeHeroVideoUrl: z.string().nullable(),
  /** Static fallback for the homepage hero, shown when there's no video
   * (or on motion tiers that never play one). */
  homeHeroImage: MediaImageSchema.nullable(),
  contactEmail: z.string(),
  bookingEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  addressCity: z.string().nullable(),
  addressRegion: z.string().nullable(),
  addressCountry: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googleMapsUrl: z.string().nullable(),
  serviceAreaText: z.string().nullable(),
  defaultSeoTitle: z.string().nullable(),
  defaultSeoDescription: z.string().nullable(),
  defaultOgImage: MediaImageSchema.nullable(),
  twitterHandle: z.string().nullable(),
  defaultAccentColor: z.string(),
  featureBlogEnabled: z.boolean(),
  featureNewsletterEnabled: z.boolean(),
  featureShopEnabled: z.boolean(),
  bookingFormEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  responseTimePromise: z.string().nullable(),

  /**
   * Homepage copy and section visibility.
   *
   * The homepage is the product - most booking clients never open a second
   * page - so the artist owns its headings and which sections appear,
   * without a developer. Null copy means "use the component's own default",
   * so an untouched settings row renders exactly what it rendered before
   * these fields existed.
   */
  homeHeroEyebrow: z.string().nullable(),
  homeHeroHeadline: z.string().nullable(),
  homeHeroSubheadline: z.string().nullable(),
  homeClosingHeadline: z.string().nullable(),
  homeClosingSubheadline: z.string().nullable(),
  homeShowIdentities: z.boolean(),
  homeShowShows: z.boolean(),
  homeShowDiscography: z.boolean(),
  homeShowResidencies: z.boolean(),
  homeShowVenues: z.boolean(),
  homeShowGallery: z.boolean(),
  homeShowVideos: z.boolean(),
  homeShowServices: z.boolean(),
  homeShowTestimonials: z.boolean(),
});
export type SiteSettingsDetail = z.infer<typeof SiteSettingsDetail>;

export const SiteSettingsAdminDetail = SiteSettingsDetail.extend({
  updatedAt: z.coerce.date(),
  /** Raw id, admin-only — see PersonaAdminDetail's identical comment for why. */
  homeHeroVideoMediaId: Id.nullable(),
  homeHeroImageMediaId: Id.nullable(),
});
export type SiteSettingsAdminDetail = z.infer<typeof SiteSettingsAdminDetail>;

/**
 * All fields optional: this is always a PATCH against the one singleton row,
 * never a create — see docs/02-architecture/backend.md.
 */
export const SiteSettingsUpdateInput = inputObject({
  siteName: z.string().min(1).max(120).optional(),
  siteTagline: z.string().max(200).nullish(),
  logoId: Id.nullish(),
  homeHeroVideoMediaId: Id.nullish(),
  homeHeroImageMediaId: Id.nullish(),
  contactEmail: z.string().email().optional(),
  bookingEmail: z.string().email().nullish(),
  contactPhone: z.string().max(20).nullish(),
  whatsappNumber: z.string().max(20).nullish(),
  addressCity: z.string().max(120).nullish(),
  addressRegion: z.string().max(120).nullish(),
  addressCountry: z.string().max(2).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  googleMapsUrl: z.string().url().nullish(),
  serviceAreaText: z.string().max(300).nullish(),
  defaultSeoTitle: z.string().max(60).nullish(),
  defaultSeoDescription: z.string().max(160).nullish(),
  defaultOgImageId: Id.nullish(),
  twitterHandle: z.string().max(40).nullish(),
  defaultAccentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  featureBlogEnabled: z.boolean().optional(),
  featureNewsletterEnabled: z.boolean().optional(),
  featureShopEnabled: z.boolean().optional(),
  bookingFormEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  responseTimePromise: z.string().max(120).nullish(),

  homeHeroEyebrow: z.string().max(80).nullish(),
  homeHeroHeadline: z.string().max(120).nullish(),
  homeHeroSubheadline: z.string().max(300).nullish(),
  homeClosingHeadline: z.string().max(120).nullish(),
  homeClosingSubheadline: z.string().max(300).nullish(),
  homeShowIdentities: z.boolean().optional(),
  homeShowShows: z.boolean().optional(),
  homeShowDiscography: z.boolean().optional(),
  homeShowResidencies: z.boolean().optional(),
  homeShowVenues: z.boolean().optional(),
  homeShowGallery: z.boolean().optional(),
  homeShowVideos: z.boolean().optional(),
  homeShowServices: z.boolean().optional(),
  homeShowTestimonials: z.boolean().optional(),
});
export type SiteSettingsUpdateInput = z.infer<typeof SiteSettingsUpdateInput>;

// ─────────────────────────────────────────────────────────────────────────────
//  Redirect
// ─────────────────────────────────────────────────────────────────────────────

export const RedirectKindSchema = z.enum(['PERMANENT', 'TEMPORARY']);
export type RedirectKind = z.infer<typeof RedirectKindSchema>;

export const RedirectDetail = z.object({
  id: Id,
  fromPath: z.string(),
  toPath: z.string(),
  kind: RedirectKindSchema,
  isActive: z.boolean(),
  hitCount: z.number().int(),
  note: z.string().nullable(),
});
export type RedirectDetail = z.infer<typeof RedirectDetail>;

const PathString = z
  .string()
  .min(1)
  .max(500)
  .regex(/^\//, 'Must start with /');

export const RedirectCreateInput = inputObject({
  fromPath: PathString,
  toPath: PathString,
  kind: RedirectKindSchema.optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).nullish(),
}).refine((v) => v.fromPath !== v.toPath, {
  message: 'A redirect cannot point to itself.',
  path: ['toPath'],
});
export type RedirectCreateInput = z.infer<typeof RedirectCreateInput>;

export const RedirectUpdateInput = inputObject({
  fromPath: PathString.optional(),
  toPath: PathString.optional(),
  kind: RedirectKindSchema.optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).nullish(),
});
export type RedirectUpdateInput = z.infer<typeof RedirectUpdateInput>;

export const RedirectQuery = PaginationSchema.and(
  z.object({
    q: z.string().max(200).optional(),
    activeOnly: z.coerce.boolean().optional(),
    sort: sortSchema(['createdAt', 'hitCount', 'fromPath']).default('-createdAt'),
  }),
);
export type RedirectQuery = z.infer<typeof RedirectQuery>;

export const RedirectAdminDetail = RedirectDetail.extend({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type RedirectAdminDetail = z.infer<typeof RedirectAdminDetail>;

// ─────────────────────────────────────────────────────────────────────────────
//  Sitemap
// ─────────────────────────────────────────────────────────────────────────────

export const SitemapEntry = z.object({
  loc: z.string(),
  lastmod: z.coerce.date(),
  changefreq: z
    .enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])
    .optional(),
  priority: z.number().min(0).max(1).optional(),
});
export type SitemapEntry = z.infer<typeof SitemapEntry>;

export const SitemapResponse = z.object({
  data: z.array(SitemapEntry),
});
export type SitemapResponse = z.infer<typeof SitemapResponse>;
