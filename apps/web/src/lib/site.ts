/**
 * Site-wide constants that are not content — i.e. things that would be true
 * even with an empty database. Everything that IS content (contact info,
 * social links, feature flags) comes from `GET /settings` via
 * `server/queries/settings.ts`, never hardcoded here.
 */
export const SITE = {
  name: 'DJ Felicitous',
  titleTemplate: '%s | DJ Felicitous — DJ in Bangalore',
  defaultTitle: 'DJ Felicitous — Multi-Genre DJ & Producer in Bengaluru',
  defaultDescription:
    'Bengaluru-based DJ and producer working across Bollywood, commercial, techno and psytrance. Weddings, corporate events, clubs and festivals.',
  locale: 'en_IN',
  twitter: '@djfelicitous',
} as const;

/** The canonical origin. Every canonical URL, OG image and sitemap entry is built from this. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}

/** Maps a `PersonaKey` to the `data-theme` value `theme.css` defines. */
export function personaThemeName(key: string): string {
  return key === 'COUPLE_DUO' ? 'duo' : key.toLowerCase();
}
