import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Every simple/taxonomy content type now has a working admin screen — see
 * the sidebar. Still missing: Personas, Tracks, Releases, Playlists,
 * Programs, Events — each needs media/relation pickers (artwork, genres,
 * lineup, track ordering) a generic scalar form can't represent yet. See
 * docs/06-roadmap/STATUS.md's Group E section for the full account.
 */
export default function DashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="font-display text-h2 text-fg-strong">Dashboard</h1>
      <p className="text-fg-secondary mt-4 max-w-xl">
        Everything in the sidebar is a working screen: content, the media library, bookings, site
        settings, redirects and the audit log. Personas, Tracks, Releases, Playlists, Programs and
        Events still need a developer — they depend on media and relation pickers (artwork, genres,
        lineup, track ordering) that don&apos;t have an admin UI yet.
      </p>
    </div>
  );
}
