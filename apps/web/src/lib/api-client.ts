import 'server-only';

import { z, type ZodTypeAny } from 'zod';

/**
 * The one place `apps/web` talks to the API.
 *
 * Server-only: the public browser never calls the API directly. That keeps
 * `API_KEY` server-side, avoids CORS entirely, and keeps the origin
 * cacheable by Next's Data Cache — a client-side fetch would bypass all of
 * that. See docs/02-architecture/frontend.md §"Data layer".
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    detail: string,
  ) {
    super(`API ${String(status)} on ${path}: ${detail}`);
  }
}

function apiBaseUrl(): string {
  const url = process.env.API_INTERNAL_URL;
  if (!url) throw new Error('API_INTERNAL_URL is not set.');
  return url;
}

export interface ApiGetOptions<S extends ZodTypeAny> {
  schema: S;
  /** Cache tags this fetch should carry, so `revalidateTag` can invalidate it. */
  tags?: string[];
  /** Seconds. `false` means tag-only invalidation, never time-based. */
  revalidate?: number | false;
  searchParams?: Record<string, string | number | boolean | undefined>;
  /** Draft-mode reads bypass the cache entirely. */
  draft?: boolean;
}

/**
 * Fetches and validates one API response against its Zod contract.
 *
 * Contract drift is **loud** on purpose — rendering `undefined` silently is
 * how the legacy site shipped broken pages. A 404 becomes `ApiError(404)` so
 * callers can `notFound()`; anything else invalid becomes a 502, which is
 * the honest status for "the upstream contract broke".
 */
export async function apiGet<S extends ZodTypeAny>(
  path: string,
  options: ApiGetOptions<S>,
): Promise<z.infer<S>> {
  const url = new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API_KEY is not set.');

  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
    ...(options.draft
      ? { cache: 'no-store' as const }
      : { next: { tags: options.tags ?? [], revalidate: options.revalidate ?? false } }),
  });

  if (response.status === 404) {
    throw new ApiError(404, path, 'not found');
  }
  if (!response.ok) {
    throw new ApiError(response.status, path, await response.text().catch(() => ''));
  }

  const json: unknown = await response.json();
  const parsed = options.schema.safeParse(json);
  if (!parsed.success) {
    console.error('contract_drift', path, parsed.error.flatten());
    throw new ApiError(502, path, 'response failed contract validation');
  }

  return parsed.data as z.infer<S>;
}

/** The `{ data: T[], meta: {...} }` envelope every list endpoint returns. */
export function collectionSchema<S extends ZodTypeAny>(item: S) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      pagination: z.object({
        mode: z.enum(['cursor', 'offset']),
        limit: z.number().int(),
        nextCursor: z.string().nullish(),
        hasMore: z.boolean(),
        page: z.number().int().nullish(),
        totalPages: z.number().int().nullish(),
        totalCount: z.number().int().nullish(),
      }),
    }),
  });
}

/** `{ data: T[] }` — the shape of the unpaginated list endpoints (tags, redirects). */
export function bareListSchema<S extends ZodTypeAny>(item: S) {
  return z.object({ data: z.array(item) });
}

/** The `{ data: [{ slug, updatedAt }] }` shape every `GET /x/slugs` endpoint returns. */
export const slugsSchema = bareListSchema(z.object({ slug: z.string(), updatedAt: z.coerce.date() }));

/**
 * A public, unauthenticated write (booking inquiries, newsletter). No cache,
 * no tags — mutations are never cached. Returns the parsed body on success;
 * throws `ApiError` with the upstream status on failure, so a server action
 * can map `422`/`429` to a field-level or rate-limit message.
 */
export async function apiPost<S extends ZodTypeAny>(
  path: string,
  body: unknown,
  schema: S,
): Promise<z.infer<S>> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API_KEY is not set.');

  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`), {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      json && typeof json === 'object' && 'message' in json ? String(json.message) : response.statusText;
    throw new ApiError(response.status, path, detail);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error('contract_drift', path, parsed.error.flatten());
    throw new ApiError(502, path, 'response failed contract validation');
  }
  return parsed.data as z.infer<S>;
}

/** Returns `null` instead of throwing on a 404 — for optional lookups. */
export async function apiGetOrNull<S extends ZodTypeAny>(
  path: string,
  options: ApiGetOptions<S>,
): Promise<z.infer<S> | null> {
  try {
    return await apiGet(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
