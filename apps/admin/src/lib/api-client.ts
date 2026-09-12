/**
 * Browser-side API client.
 *
 * Admin calls the API directly from the browser (unlike `apps/web`, which
 * never does) — see `apps/admin/package.json`'s own comment on
 * `NEXT_PUBLIC_API_URL`. The access token lives in memory only (never
 * `localStorage`, so an XSS payload cannot read it back out later); the
 * refresh token is an httpOnly cookie this code never touches directly.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    public readonly path: string,
    detail: string,
  ) {
    super(`API ${String(status)} on ${path}: ${detail}`);
  }
}

function apiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set.');
  return url;
}

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith('dj_csrf='));
  return match?.split('=')[1];
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  /** Set by `refresh()` itself, so it does not try to refresh its own 401. */
  skipRefreshOn401?: boolean;
}

/**
 * One retry on a 401: attempts `/auth/refresh` (which relies on the httpOnly
 * refresh cookie the browser sends automatically) and replays the original
 * request with the new access token. `onTokenRefreshed` lets the caller
 * (the auth context) keep its in-memory token in sync.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
  onTokenRefreshed?: (accessToken: string) => void,
): Promise<T> {
  const url = new URL(path.replace(/^\//, ''), `${apiBaseUrl()}/`);
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.accessToken) headers.authorization = `Bearer ${options.accessToken}`;

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (response.status === 401 && !options.skipRefreshOn401) {
    const csrf = readCsrfCookie();
    const refreshResponse = await fetch(new URL('auth/refresh', `${apiBaseUrl()}/`), {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    if (refreshResponse.ok) {
      const { accessToken } = (await refreshResponse.json()) as { accessToken: string };
      onTokenRefreshed?.(accessToken);
      return apiFetch<T>(path, { ...options, accessToken, skipRefreshOn401: true }, onTokenRefreshed);
    }
  }

  if (response.status === 204) return undefined as T;

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = json && typeof json === 'object' && 'detail' in json ? String(json.detail) : response.statusText;
    const code = json && typeof json === 'object' && 'code' in json ? String(json.code) : undefined;
    throw new ApiError(response.status, code, path, detail);
  }

  return json as T;
}
