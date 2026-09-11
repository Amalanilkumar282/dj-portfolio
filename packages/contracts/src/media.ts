import { z } from 'zod';

import { Id, PaginationSchema, inputObject, sortSchema } from './common.js';

/**
 * Media pipeline contracts. See docs/02-architecture/media-pipeline.md.
 *
 * The upload flow is two calls: `POST /admin/media/upload-signature` gets a
 * signed, server-decided destination; the browser uploads straight to
 * Cloudinary; `POST /admin/media` ("confirm") hands back the Cloudinary
 * `public_id` and the server re-reads authoritative metadata via the
 * Cloudinary Admin API before writing the row. The client's own claims about
 * bytes/format/dimensions are never trusted.
 */

export const MediaResourceTypeSchema = z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'RAW']);
export type MediaResourceType = z.infer<typeof MediaResourceTypeSchema>;

export const MediaPurposeSchema = z.enum([
  'HERO',
  'GALLERY',
  'AVATAR',
  'FLYER',
  'COVER_ART',
  'LOGO',
  'PRESS_PHOTO',
  'DOCUMENT',
  'BACKGROUND_VIDEO',
  'OG_IMAGE',
  'GEAR',
]);
export type MediaPurpose = z.infer<typeof MediaPurposeSchema>;

/**
 * The taxonomy segment of the Cloudinary folder path.
 *
 * The server, not the client, decides the folder from this plus `purpose` —
 * see `MediaService.folderFor()`. A client cannot write outside its taxonomy
 * because it never gets to name the folder itself.
 */
export const MediaEntityTypeSchema = z.enum([
  'persona',
  'event',
  'venue',
  'track',
  'playlist',
  'release',
  'gallery',
  'video',
  'testimonial',
  'brand',
  'service',
  'gear',
  'experience',
  'post',
  'press-kit',
  'settings',
  'misc',
]);
export type MediaEntityType = z.infer<typeof MediaEntityTypeSchema>;

export const MediaUploadSignatureInput = inputObject({
  purpose: MediaPurposeSchema,
  entityType: MediaEntityTypeSchema,
  resourceType: MediaResourceTypeSchema.default('IMAGE'),
  /** Used only to namespace the folder, e.g. `djf/prod/personas/tnt/gallery`. */
  personaSlug: z.string().max(80).optional(),
});
export type MediaUploadSignatureInput = z.infer<typeof MediaUploadSignatureInput>;

export const MediaUploadSignatureResult = z.object({
  signature: z.string(),
  timestamp: z.number().int(),
  apiKey: z.string(),
  cloudName: z.string(),
  folder: z.string(),
  resourceType: MediaResourceTypeSchema,
  /** Echoed back so the client's upload params match what was signed exactly. */
  eager: z.string().nullish(),
  eagerAsync: z.boolean().nullish(),
});
export type MediaUploadSignatureResult = z.infer<typeof MediaUploadSignatureResult>;

export const MediaConfirmInput = inputObject({
  publicId: z.string().min(1).max(500),
  purpose: MediaPurposeSchema,
  /**
   * The intended asset type, echoing what was signed in the upload-signature
   * step. Needed because Cloudinary itself has no "audio" resource type — it
   * treats audio as `video` — so the server cannot recover AUDIO vs VIDEO
   * from the Cloudinary response alone.
   */
  resourceType: MediaResourceTypeSchema,
  altText: z.string().max(300).nullish(),
  caption: z.string().max(500).nullish(),
  credit: z.string().max(200).nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});
export type MediaConfirmInput = z.infer<typeof MediaConfirmInput>;

export const MediaAssetAdminDetail = z.object({
  id: Id,
  publicId: z.string(),
  resourceType: MediaResourceTypeSchema,
  format: z.string(),
  bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationSec: z.number().nullable(),
  pages: z.number().int().nullable(),
  secureUrl: z.string(),
  folder: z.string(),
  purpose: MediaPurposeSchema,
  originalFilename: z.string().nullable(),
  dominantColor: z.string().nullable(),
  blurDataUrl: z.string().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
  tags: z.array(z.string()),
  focalX: z.number().nullable(),
  focalY: z.number().nullable(),
  waveformPeaks: z.array(z.number()).nullable(),
  isSensitive: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MediaAssetAdminDetail = z.infer<typeof MediaAssetAdminDetail>;

export const MediaUpdateInput = inputObject({
  altText: z.string().max(300).nullish(),
  caption: z.string().max(500).nullish(),
  credit: z.string().max(200).nullish(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  focalX: z.number().min(0).max(1).nullish(),
  focalY: z.number().min(0).max(1).nullish(),
  isSensitive: z.boolean().optional(),
});
export type MediaUpdateInput = z.infer<typeof MediaUpdateInput>;

export const MediaAdminQuery = PaginationSchema.and(
  z.object({
    q: z.string().max(120).optional(),
    purpose: MediaPurposeSchema.optional(),
    resourceType: MediaResourceTypeSchema.optional(),
    /** The trash view. Defaults to excluding soft-deleted assets. */
    trashed: z.coerce.boolean().optional(),
    sort: sortSchema(['createdAt', 'bytes']).default('-createdAt'),
  }),
);
export type MediaAdminQuery = z.infer<typeof MediaAdminQuery>;
