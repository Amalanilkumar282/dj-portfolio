import type { Metadata, Viewport } from 'next';

import { AuthProvider } from '../lib/auth-context';

import './globals.css';

/**
 * Admin root layout.
 *
 * `<AuthProvider>` sits here, above every route (including `/login`), so a
 * silent-refresh attempt runs once per page load regardless of which route
 * was requested directly.
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

export default function AdminRootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
