'use client';

import Script from 'next/script';

/**
 * Cloudflare Turnstile challenge. Renders nothing when the site key is unset
 * or still the documented placeholder — matching `TurnstileService`'s own
 * skip behaviour on the API side, so local/preview environments without a
 * real Turnstile site work exactly as before.
 *
 * Cloudflare's script auto-renders any `.cf-turnstile` element and injects a
 * hidden `cf-turnstile-response` input into its containing `<form>` — no
 * React state needed here, the plain `<form action={serverAction}>` on
 * `/book` picks the token up from `FormData` like every other field.
 */
export function TurnstileWidget(): React.JSX.Element | null {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey || /replace.?me/i.test(siteKey)) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" />
    </>
  );
}
