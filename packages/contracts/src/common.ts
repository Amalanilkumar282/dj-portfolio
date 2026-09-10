import { z } from 'zod';

/**
 * Shared primitives every resource contract builds on.
 *
 * These are the Zod schemas that drive validation, OpenAPI generation and
 * frontend types from one definition. See ADR 0004.
 */

/** cuid2 - 24-32 lowercase alphanumerics. */
export const Id = z.string().regex(/^[a-z0-9]{20,32}$/, 'Invalid id');

/** URL-safe slug. Matches what `slugify` in @dj/utils produces. */
export const Slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase words separated by single hyphens');

export const ContentStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

/**
 * SEO metadata. The length caps are the practical limits at which Google
 * truncates in the SERP, so they are validation rather than advice.
 */
export const SeoMetaSchema = z.object({
  title: z.string().max(60).nullish(),
  description: z.string().max(160).nullish(),
  keywords: z.array(z.string()).default([]),
  canonicalUrl: z.string().url().nullish(),
  ogTitle: z.string().max(70).nullish(),
  ogDescription: z.string().max(200).nullish(),
  noIndex: z.boolean().default(false),
  noFollow: z.boolean().default(false),
});
export type SeoMeta = z.infer<typeof SeoMetaSchema>;

/**
 * An image as the frontend needs it.
 *
 * `blurDataUrl` is non-nullable on purpose: it is computed at upload and
 * stored, so `placeholder="blur"` costs nothing at runtime. If it were
 * optional, every consumer would need a fallback branch.
 */
export const MediaImageSchema = z.object({
  publicId: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Required for in-page images; a DB CHECK constraint enforces it too. */
  altText: z.string(),
  blurDataUrl: z.string(),
  dominantColor: z.string().nullish(),
  /** Normalised 0-1, drives object-position so crops do not decapitate. */
  focalX: z.number().min(0).max(1).nullish(),
  focalY: z.number().min(0).max(1).nullish(),
});
export type MediaImage = z.infer<typeof MediaImageSchema>;

/**
 * Pagination. Cursor for public infinite lists (stable while content is
 * published), offset for admin tables (which need "page 7 of 23").
 */
export const PaginationSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((v) => !(v.cursor && v.page), {
    message: 'Use either cursor or page, not both',
  });
export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginationMetaSchema = z.object({
  mode: z.enum(['cursor', 'offset']),
  limit: z.number().int(),
  nextCursor: z.string().nullish(),
  hasMore: z.boolean(),
  page: z.number().int().nullish(),
  totalPages: z.number().int().nullish(),
  totalCount: z.number().int().nullish(),
});

/** Collection envelope. Single resources are returned bare. */
export function collection<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      pagination: PaginationMetaSchema,
      sort: z.string().optional(),
      filters: z.record(z.unknown()).optional(),
    }),
  });
}

/**
 * Builds a sort parser restricted to an allowlist.
 *
 * The allowlist is the guarantee that every sortable column has an index -
 * a generic sort parameter is an unbounded query surface.
 *
 *   sortSchema(['startsAt', 'title'])  parses  "-startsAt,title"
 */
export function sortSchema(allowed: readonly string[]) {
  const set = new Set<string>(allowed);
  return z
    .string()
    .transform((value, ctx) => {
      const parsed = value.split(',').map((part) => {
        const desc = part.startsWith('-');
        const field = desc ? part.slice(1) : part;
        if (!set.has(field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Cannot sort by "${field}". Allowed: ${allowed.join(', ')}`,
          });
        }
        return { field, direction: desc ? ('desc' as const) : ('asc' as const) };
      });
      return parsed;
    })
    .pipe(z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) })));
}

/**
 * Builds an include parser restricted to an allowlist.
 *
 * This is the N+1 and over-fetch guard: the API physically cannot be asked
 * for a relation that is not on the list.
 */
export function includeSchema(allowed: readonly string[]) {
  const set = new Set<string>(allowed);
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return [] as string[];
      const parts = value.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (!set.has(part)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Cannot include "${part}". Allowed: ${allowed.join(', ')}`,
          });
        }
      }
      return parts;
    });
}

/** RFC 9457 problem details - the shape of every API error. */
export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  code: z.string().optional(),
  errors: z
    .array(
      z.object({
        /** JSON Pointer, so admin forms map errors to fields mechanically. */
        pointer: z.string(),
        code: z.string().optional(),
        message: z.string(),
      }),
    )
    .optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
