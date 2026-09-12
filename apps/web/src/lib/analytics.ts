/**
 * Consent-gated event dispatch.
 *
 * A real `@dj/analytics` package (per the masterplan) would own the consent
 * state machine, multi-provider fan-out and typed event catalogue. Scoped
 * down here to what Phase 8 actually needs — Plausible only, gated by a
 * server-read cookie so no tag ever ships to a non-consenting visitor — and
 * documented as a deliberate reduction rather than built silently smaller
 * than planned. Revisit as a shared package once `apps/admin` needs the same
 * event bus.
 */

export const CONSENT_COOKIE = 'dj_consent';

export type AnalyticsEvent =
  | 'booking_started'
  | 'booking_submitted'
  | 'whatsapp_click'
  | 'phone_click'
  | 'email_click';

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

/**
 * Fires a Plausible custom event if the script has loaded (which only
 * happens when consent was granted — see `AnalyticsScript`). Safe to call
 * unconditionally: a no-op before consent, before the script loads, or when
 * `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is unset.
 */
export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined' || typeof window.plausible !== 'function') return;
  window.plausible(event, props ? { props } : undefined);
}
