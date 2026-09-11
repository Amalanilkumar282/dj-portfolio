/**
 * Metadata keys and shared constants.
 *
 * Keys are exported as symbols-in-string form rather than bare strings so a
 * typo in a Reflector lookup is a compile error at the call site rather than a
 * guard that silently never fires — which, for an authorization guard, is the
 * worst possible failure mode.
 */

export const IS_PUBLIC_KEY = 'dj:isPublic';
export const PERMISSIONS_KEY = 'dj:permissions';
export const CACHE_POLICY_KEY = 'dj:cachePolicy';
export const TIMEOUT_KEY = 'dj:timeout';
export const IDEMPOTENT_KEY = 'dj:idempotent';
export const AUDIT_KEY = 'dj:audit';
export const SKIP_TRANSFORM_KEY = 'dj:skipTransform';

/** Cookie carrying the opaque rotating refresh token. */
export const REFRESH_COOKIE = 'dj_rt';
/** Cookie carrying the CSRF double-submit token. */
export const CSRF_COOKIE = 'dj_csrf';
/** Header the client must echo the CSRF cookie value in. */
export const CSRF_HEADER = 'x-csrf-token';

/** Correlation id header, honoured inbound and always echoed outbound. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Default handler timeout. Override per route with @Timeout(). */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Sentinel actor for operations with no authenticated user: cron jobs, seeds,
 * migrations. Audit rows attribute these rather than leaving a null actor,
 * which would be indistinguishable from a bug.
 */
export const SYSTEM_ACTOR = 'system';

/**
 * Prisma operations above which a single request is treated as suspicious.
 *
 * The persona page aggregate is the heaviest legitimate read in the system, so
 * this sits just above it: high enough not to cry wolf, low enough that a
 * genuine N+1 trips it immediately. It is also the Phase 4 exit criterion the
 * e2e suite asserts against.
 *
 * Lives here rather than beside PrismaService because it is a policy number
 * read by the interceptor, and importing it from `prisma.service` would drag
 * the data-access module into `common/` for a single integer.
 */
export const QUERY_WARN_THRESHOLD = 8;
