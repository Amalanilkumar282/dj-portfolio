import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Every content type the API supports now has a working admin screen.
 * Two structural limitations remain, documented in STATUS.md rather than
 * silently worked around: a track cannot be attached to a release yet (no
 * write path exists in the contract for that relation), and a persona's
 * social links are read-only in this form (same reason).
 */
export default function DashboardPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="font-display text-h2 text-fg-strong">Dashboard</h1>
      <p className="text-fg-secondary mt-4 max-w-xl">
        Every content type has a working screen now — Personas, Tracks, Releases, Playlists,
        Programs and Events, alongside the simpler content types and the media library. Two known
        gaps: a track can&apos;t yet be attached to a release from here, and a persona&apos;s social
        links are read-only — both need a small contract change first. See STATUS.md.
      </p>
    </div>
  );
}
