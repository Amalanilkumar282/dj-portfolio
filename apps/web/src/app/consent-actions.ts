'use server';

import { cookies } from 'next/headers';

import { CONSENT_COOKIE } from '../lib/analytics';

/**
 * Sets consent as a real `Set-Cookie` response, not `document.cookie` from
 * the client — so the very next server render (including the one that
 * decides whether to inject the Plausible script) sees it immediately,
 * without waiting for a second round trip.
 */
export async function setConsent(value: 'granted' | 'denied'): Promise<void> {
  const store = await cookies();
  store.set(CONSENT_COOKIE, value, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  });
}
