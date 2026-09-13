import { SetMetadata } from '@nestjs/common';

import { CACHE_POLICY_KEY } from '../constants';

export interface CachePolicy {
  /** Literal Cache-Control value. */
  header: string;
  /** Emit a strong ETag and honour If-None-Match. */
  etag?: boolean;
}

/**
 * Named policies, so a route declares intent rather than restating a header.
 *
 * `publicContent` carries a long stale-while-revalidate deliberately: the
 * revalidation webhook is what makes content fresh, so a stale edge response
 * is a fallback rather than the norm.
 * See docs/02-architecture/caching-and-revalidation.md
 */
export const CACHE_POLICIES = {
  publicContent: {
    header: 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    etag: true,
  },
  publicSlow: {
    header: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    etag: true,
  },
  sitemap: {
    header: 'public, max-age=0, s-maxage=1800, stale-while-revalidate=86400',
    etag: true,
  },
  /** Admin and every mutation. Never cached anywhere. */
  noStore: { header: 'no-store, no-cache, must-revalidate', etag: false },
} as const satisfies Record<string, CachePolicy>;

export const CacheControl = (policy: CachePolicy) => SetMetadata(CACHE_POLICY_KEY, policy);
