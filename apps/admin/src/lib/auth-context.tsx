'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch, ApiError } from './api-client';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  totpEnabled: boolean;
}

interface LoginResult {
  totpRequired?: boolean;
}

interface AuthState {
  user: AdminUser | null;
  /** `null` until the initial silent-refresh attempt on mount resolves. */
  loading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  /** For screens that need to call the API themselves (lists, forms). */
  request: <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) => Promise<T>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;
  }, []);

  const request = useCallback(
    async <T,>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}) => {
      return apiFetch<T>(path, { ...options, accessToken: tokenRef.current }, setToken);
    },
    [setToken],
  );

  useEffect(() => {
    // A silent refresh on load: the httpOnly refresh cookie may still be
    // valid even though the in-memory access token was lost on a full page
    // reload — this is what keeps the admin from demanding a re-login every
    // time the tab refreshes.
    apiFetch<{ accessToken: string }>('auth/refresh', { method: 'POST' }, setToken)
      .then(async ({ accessToken }) => {
        setToken(accessToken);
        const me = await apiFetch<AdminUser>('auth/me', { accessToken }, setToken);
        setUser(me);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount by design
  }, []);

  const login = useCallback(
    async (email: string, password: string, totp?: string): Promise<LoginResult> => {
      const body: { email: string; password: string; totp?: string } = { email, password };
      if (totp) body.totp = totp;

      const result = await apiFetch<{ totpRequired?: true; accessToken?: string; user?: AdminUser }>(
        'auth/login',
        { method: 'POST', body },
        setToken,
      );

      if (result.totpRequired) return { totpRequired: true };
      if (result.accessToken && result.user) {
        setToken(result.accessToken);
        setUser(result.user);
      }
      return {};
    },
    [setToken],
  );

  const logout = useCallback(async () => {
    try {
      await request('auth/logout', { method: 'POST' });
    } catch (error) {
      // Logging out must still clear local state even if the server call
      // fails (e.g. the session already expired) — an admin stuck on a
      // "logged in" screen with a dead session is worse than a no-op call.
      if (!(error instanceof ApiError)) throw error;
    } finally {
      setToken(null);
      setUser(null);
    }
  }, [request, setToken]);

  const can = useCallback((permission: string) => user?.permissions.includes(permission) ?? false, [user]);

  const value = useMemo(() => ({ user, loading, login, logout, can, request }), [user, loading, login, logout, can, request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
