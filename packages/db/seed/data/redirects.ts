import { RedirectKind } from '@prisma/client';

/**
 * Legacy URL map.
 *
 * The old site had six real routes. Every one of them must 301 to its new
 * home or the site loses whatever ranking and inbound links it had. These are
 * seeded into the Redirect table AND mirrored as static redirects in
 * apps/web/next.config.ts — the static list is what serves them at the edge
 * with no database round trip; the table is what lets the DJ add future slug
 * changes without a deploy.
 *
 * The legacy footer also linked to eight routes that never existed and always
 * 404d. Those are listed here too, pointed at the pages that now exist, since
 * any indexed 404 is worth reclaiming.
 *
 * See docs/07-content/legacy-audit.md
 */
export interface SeedRedirect {
  fromPath: string;
  toPath: string;
  kind: RedirectKind;
  note: string;
}

export const seedRedirects: SeedRedirect[] = [
  // --- real legacy routes -------------------------------------------------
  {
    fromPath: '/bollywood',
    toPath: '/felicitous',
    kind: RedirectKind.PERMANENT,
    note: 'Legacy persona route. Renamed to the stage name for SEO clarity.',
  },
  {
    fromPath: '/psytrance',
    toPath: '/trinitrocosmic',
    kind: RedirectKind.PERMANENT,
    note: 'Legacy persona route.',
  },
  {
    fromPath: '/techno',
    toPath: '/tnt',
    kind: RedirectKind.PERMANENT,
    note: 'Legacy persona route.',
  },
  {
    fromPath: '/couple-duo',
    toPath: '/felicitous-x-geetz',
    kind: RedirectKind.PERMANENT,
    note: 'Legacy persona route.',
  },
  {
    fromPath: '/discography',
    toPath: '/music',
    kind: RedirectKind.PERMANENT,
    note: 'Legacy discography page. /music is the new index.',
  },

  // --- legacy footer links that always 404d -------------------------------
  {
    fromPath: '/contact',
    toPath: '/contact',
    kind: RedirectKind.PERMANENT,
    note: 'Was a dead footer link on the legacy site; the route now exists. No-op, kept for documentation.',
  },
  {
    fromPath: '/about',
    toPath: '/about',
    kind: RedirectKind.PERMANENT,
    note: 'Was a dead footer link; the route now exists.',
  },
  {
    fromPath: '/press',
    toPath: '/press',
    kind: RedirectKind.PERMANENT,
    note: 'Was a dead footer link; the press kit now exists.',
  },
  {
    fromPath: '/rider',
    toPath: '/rider',
    kind: RedirectKind.PERMANENT,
    note: 'Was a dead footer link; the technical rider now exists.',
  },
  {
    fromPath: '/collaborate',
    toPath: '/contact',
    kind: RedirectKind.PERMANENT,
    note: 'Dead legacy footer link. Collaboration enquiries go through the contact page.',
  },
  {
    fromPath: '/services/weddings',
    toPath: '/services/weddings',
    kind: RedirectKind.PERMANENT,
    note: 'Legacy footer link that opened a modal instead of navigating. Now a real page.',
  },
  {
    fromPath: '/services/corporate',
    toPath: '/services/corporate',
    kind: RedirectKind.PERMANENT,
    note: 'As above.',
  },
  {
    fromPath: '/services/private',
    toPath: '/services/private-parties',
    kind: RedirectKind.PERMANENT,
    note: 'As above, renamed for clarity.',
  },
  {
    fromPath: '/services/festivals',
    toPath: '/services/festivals',
    kind: RedirectKind.PERMANENT,
    note: 'As above.',
  },
  {
    fromPath: '/services/production',
    toPath: '/services/production',
    kind: RedirectKind.PERMANENT,
    note: 'As above.',
  },
];

/**
 * Redirects that are genuine path changes, i.e. excluding the no-op entries
 * above that exist only to document a previously-broken link.
 *
 * This is the list apps/web/next.config.ts mirrors as static edge redirects.
 */
export const activePathChanges = seedRedirects.filter((r) => r.fromPath !== r.toPath);
