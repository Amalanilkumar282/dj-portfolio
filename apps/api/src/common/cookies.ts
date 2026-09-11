/**
 * Reads the parsed cookie jar off a request.
 *
 * Express's types declare `request.cookies` as always present, which is not
 * true: it only exists once `cookie-parser` has run. A route reached before
 * that middleware — or a unit test constructing a bare request object — has
 * `undefined` there, and `cookies[NAME]` then throws a TypeError that
 * surfaces as a 500 on an auth route.
 *
 * The parameter is typed as optional so the runtime guard is honest rather
 * than something the type checker calls unnecessary.
 */
export function readCookies(request: { cookies?: unknown }): Record<string, string | undefined> {
  const jar = request.cookies;

  if (typeof jar !== 'object' || jar === null) return {};

  return jar as Record<string, string | undefined>;
}
