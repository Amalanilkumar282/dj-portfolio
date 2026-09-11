/**
 * RFC 9457 problem type URIs and the canonical problem shape.
 *
 * Every error response is `application/problem+json`. The `type` URI is a
 * real, documented page under /api/docs/problems, so a consumer hitting an
 * unfamiliar error has somewhere to go.
 *
 * See docs/02-architecture/api-conventions.md
 */

/** Base for every problem type URI. Kept relative-safe for local dev. */
const BASE = 'https://api.djfelicitous.com/problems';

export const PROBLEM_TYPES = {
  badRequest: `${BASE}/bad-request`,
  unauthorized: `${BASE}/unauthorized`,
  forbidden: `${BASE}/forbidden`,
  notFound: `${BASE}/not-found`,
  methodNotAllowed: `${BASE}/method-not-allowed`,
  conflict: `${BASE}/conflict`,
  gone: `${BASE}/gone`,
  payloadTooLarge: `${BASE}/payload-too-large`,
  unprocessable: `${BASE}/validation-failed`,
  tooManyRequests: `${BASE}/too-many-requests`,
  internal: `${BASE}/internal-error`,
  notImplemented: `${BASE}/not-implemented`,
  badGateway: `${BASE}/bad-gateway`,
  unavailable: `${BASE}/service-unavailable`,
  timeout: `${BASE}/request-timeout`,
} as const;

/** Machine-readable error codes, distinct from HTTP status. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNIQUE_CONSTRAINT: 'UNIQUE_CONSTRAINT',
  FOREIGN_KEY_CONSTRAINT: 'FOREIGN_KEY_CONSTRAINT',
  CHECK_CONSTRAINT: 'CHECK_CONSTRAINT',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  TOTP_REQUIRED: 'TOTP_REQUIRED',
  TOTP_INVALID: 'TOTP_INVALID',
  /**
   * No credential was presented at all. The client should send the user to
   * sign in; there is nothing to refresh.
   */
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  /**
   * An access token was presented but is expired or malformed. This is the
   * one 401 the admin client should respond to by silently calling
   * `/auth/refresh` and retrying once — which is why it is distinct from the
   * refresh-token codes below. Collapsing them into one code leaves the
   * client unable to tell "renew the session" from "the session is gone".
   */
  ACCESS_TOKEN_INVALID: 'ACCESS_TOKEN_INVALID',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  CSRF_FAILED: 'CSRF_FAILED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  MEDIA_IN_USE: 'MEDIA_IN_USE',
  /**
   * A taxonomy row still tagged on content. Distinct from MEDIA_IN_USE so the
   * admin can offer the right remedy: re-tag the content, rather than replace
   * an asset. Both exist because the underlying relations **cascade**, so the
   * delete would succeed and silently strip the association.
   */
  GENRE_IN_USE: 'GENRE_IN_USE',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  SLUG_TAKEN: 'SLUG_TAKEN',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  CONTRACT_DRIFT: 'CONTRACT_DRIFT',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  /** A dependent external service (Cloudinary, Resend) is unconfigured or unreachable. */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Human titles per status, so the filter never invents one. */
export const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  422: 'Validation Failed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

const TYPE_BY_STATUS: Record<number, string> = {
  400: PROBLEM_TYPES.badRequest,
  401: PROBLEM_TYPES.unauthorized,
  403: PROBLEM_TYPES.forbidden,
  404: PROBLEM_TYPES.notFound,
  405: PROBLEM_TYPES.methodNotAllowed,
  408: PROBLEM_TYPES.timeout,
  409: PROBLEM_TYPES.conflict,
  410: PROBLEM_TYPES.gone,
  413: PROBLEM_TYPES.payloadTooLarge,
  422: PROBLEM_TYPES.unprocessable,
  429: PROBLEM_TYPES.tooManyRequests,
  500: PROBLEM_TYPES.internal,
  501: PROBLEM_TYPES.notImplemented,
  502: PROBLEM_TYPES.badGateway,
  503: PROBLEM_TYPES.unavailable,
};

export function problemTypeFor(status: number): string {
  return TYPE_BY_STATUS[status] ?? PROBLEM_TYPES.internal;
}

export function titleFor(status: number): string {
  return STATUS_TITLES[status] ?? 'Error';
}
