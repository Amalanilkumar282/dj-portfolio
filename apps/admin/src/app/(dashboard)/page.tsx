import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Only one content type has a full admin screen so far — Venues (see
 * STATUS.md's Group E section for why, and what's deferred). This page is
 * the map of what exists today, not a finished dashboard.
 */
export default function DashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="font-display text-h2 text-fg-strong">Dashboard</h1>
      <p className="text-fg-secondary mt-4 max-w-xl">
        Venues is the one content type with a working admin screen today. Every other content type
        (Personas, Tracks, Events, Releases, Playlists, Programs, and the rest) is built and verified
        in the API but has no admin UI yet — see the sidebar.
      </p>
    </div>
  );
}
