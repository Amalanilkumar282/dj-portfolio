import { cookies } from 'next/headers';
import Script from 'next/script';

import { CONSENT_COOKIE } from '../lib/analytics';

/**
 * Server Component: reads the consent cookie itself, so a non-consenting
 * visitor's HTML never contains the Plausible `<script>` tag at all — not
 * "hidden by JS", genuinely absent from the response.
 */
export async function AnalyticsScript(): Promise<React.JSX.Element | null> {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  const store = await cookies();
  if (store.get(CONSENT_COOKIE)?.value !== 'granted') return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.outbound-links.js"
      strategy="afterInteractive"
    />
  );
}
