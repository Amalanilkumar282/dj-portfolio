import type { Metadata, Viewport } from 'next';

import { JsonLd, breadcrumbList } from '../lib/json-ld';
import { SITE, absoluteUrl } from '../lib/site';

import './globals.css';

/**
 * Root layout.
 *
 * Deliberately thin: header, footer, nav and the mini player belong to
 * `(marketing)/layout.tsx`, not here, so a future `(admin-preview)` or
 * other route group is never forced to inherit the marketing chrome. See
 * docs/02-architecture/frontend.md.
 */
export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl('/')),
  title: {
    default: SITE.defaultTitle,
    template: SITE.titleTemplate,
  },
  description: SITE.defaultDescription,
  alternates: { languages: { 'en-IN': '/', 'x-default': '/' } },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.locale,
  },
  twitter: { card: 'summary_large_image', site: SITE.twitter },
};

/**
 * No `maximumScale` and no `userScalable: false`.
 *
 * The legacy site set `maximum-scale: 1`, which disables pinch-zoom and is a
 * WCAG 1.4.4 failure. Do not reintroduce it.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

const siteGraph = [
  {
    '@type': 'WebSite',
    '@id': `${absoluteUrl('/')}#website`,
    name: SITE.name,
    url: absoluteUrl('/'),
    inLanguage: 'en-IN',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@type': 'Organization',
    '@id': `${absoluteUrl('/')}#organization`,
    name: SITE.name,
    url: absoluteUrl('/'),
  },
  breadcrumbList([{ name: 'Home', url: absoluteUrl('/') }]),
];

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en-IN">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-(--radius-sm) focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        {children}
        <JsonLd graph={siteGraph} />
      </body>
    </html>
  );
}
