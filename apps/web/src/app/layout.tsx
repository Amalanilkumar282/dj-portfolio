import type { Metadata, Viewport } from 'next';

import './globals.css';

/**
 * Root layout — Phase 0 scaffold.
 *
 * Phase 7 adds: the three self-hosted variable fonts, the (marketing) route
 * group with header/footer/mini-player, skip links, the JSON-LD graph and the
 * route announcer.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'DJ Felicitous — Multi-Genre DJ & Producer in Bengaluru',
    template: '%s | DJ Felicitous — DJ in Bangalore',
  },
  description:
    'Bengaluru-based DJ and producer working across Bollywood, commercial, techno and psytrance. Weddings, corporate events, clubs and festivals.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
