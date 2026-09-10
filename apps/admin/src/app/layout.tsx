import type { Metadata, Viewport } from 'next';

import './globals.css';

/**
 * Admin root layout — Phase 0 scaffold.
 *
 * Phase 11 adds: the auth gate, sidebar, top bar with command palette,
 * TanStack Query provider and the RBAC-driven navigation.
 */
export const metadata: Metadata = {
  title: 'DJ Felicitous — Admin',
  // Belt and braces alongside the X-Robots-Tag header in next.config.ts.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
