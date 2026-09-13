'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

export function LoginForm(): React.JSX.Element {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    router.replace('/');
    return <></>;
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, needsTotp ? totp : undefined);
      if (result.totpRequired) {
        setNeedsTotp(true);
      } else {
        router.replace('/');
      }
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        setError('Incorrect email or password.');
      } else {
        setError('Something went wrong signing in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-eyebrow text-fg-muted uppercase">DJ Felicitous</p>
        <h1 className="font-display text-h2 text-fg-strong mt-2">Admin sign in</h1>
      </div>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="text-fg-strong text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-fg-strong text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        {needsTotp ? (
          <div>
            <label htmlFor="totp" className="text-fg-strong text-sm font-medium">
              Two-factor code
            </label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={totp}
              onChange={(event) => {
                setTotp(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-on-accent w-full rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
