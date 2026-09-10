/**
 * Model capability registries.
 *
 * The extensions in ./extensions read these to decide which models get soft
 * delete, audit stamping and publish filtering. Keeping them as explicit
 * literal tuples (rather than reflecting over the DMMF at runtime) means
 * adding a model without deciding its behaviour is a TypeScript error, not a
 * silent omission that ships a hard-deleting endpoint.
 */

/** Models carrying a `deletedAt` column. */
export const SOFT_DELETE_MODELS = [
  'User',
  'MediaAsset',
  'Persona',
  'Track',
  'Playlist',
  'Release',
  'Venue',
  'Event',
  'Program',
  'Gallery',
  'Video',
  'Testimonial',
  'Brand',
  'ExperienceEntry',
  'GearItem',
  'Service',
  'Faq',
  'PressAsset',
  'Post',
  'StaticPage',
  'BookingInquiry',
] as const;

/** Models carrying `createdBy` / `updatedBy`. */
export const AUDITED_MODELS = [
  'Persona',
  'Track',
  'Playlist',
  'Release',
  'Venue',
  'Event',
  'Program',
  'Gallery',
  'Video',
  'Testimonial',
  'Brand',
  'ExperienceEntry',
  'GearItem',
  'Service',
  'Faq',
  'PressAsset',
  'Post',
  'StaticPage',
] as const;

/** Models carrying the `status` / `publishedAt` / `scheduledAt` triple. */
export const PUBLISHABLE_MODELS = [
  'Persona',
  'Track',
  'Playlist',
  'Release',
  'Venue',
  'Event',
  'Program',
  'Gallery',
  'Video',
  'Testimonial',
  'Brand',
  'ExperienceEntry',
  'GearItem',
  'Service',
  'Faq',
  'PressAsset',
  'Post',
  'StaticPage',
] as const;

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];
export type AuditedModel = (typeof AUDITED_MODELS)[number];
export type PublishableModel = (typeof PUBLISHABLE_MODELS)[number];

const softDeleteSet: ReadonlySet<string> = new Set(SOFT_DELETE_MODELS);
const auditedSet: ReadonlySet<string> = new Set(AUDITED_MODELS);
const publishableSet: ReadonlySet<string> = new Set(PUBLISHABLE_MODELS);

export const isSoftDeleteModel = (model: string | undefined): model is SoftDeleteModel =>
  model != null && softDeleteSet.has(model);

export const isAuditedModel = (model: string | undefined): model is AuditedModel =>
  model != null && auditedSet.has(model);

export const isPublishableModel = (model: string | undefined): model is PublishableModel =>
  model != null && publishableSet.has(model);
