/**
 * Draft Mode live preview links, opened in a new tab. `apps/web`'s
 * `/api/draft` route enables Next Draft Mode and redirects to `path` — see
 * that route's own comment for why the token is treated as a shared
 * secret between it and whoever is allowed to construct these links
 * (admin users, by design).
 */
export function previewUrl(path: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const token = process.env.NEXT_PUBLIC_PREVIEW_TOKEN;
  if (!site || !token) return null;
  const url = new URL('/api/draft', site);
  url.searchParams.set('token', token);
  url.searchParams.set('path', path);
  return url.toString();
}
