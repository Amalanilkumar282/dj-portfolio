/**
 * Placeholder home page — Phase 0 scaffold.
 *
 * Phase 7 replaces this with the real home page. Note there is no
 * `'use client'` here and there never should be: the
 * `dj/no-client-in-route-files` lint rule forbids it in page and layout
 * files, because that was the legacy failure that cost the old site all of
 * its server rendering and SEO.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <p className="text-eyebrow text-fg-muted uppercase">Scaffold</p>
      <h1 className="font-display text-h1 text-fg-strong">DJ Felicitous</h1>
      <p className="text-lead text-fg-secondary">
        The public site is scaffolded but not yet built. The data layer is complete.
      </p>
      <p className="text-body text-fg-muted">
        Read <code className="text-accent">docs/06-roadmap/STATUS.md</code> for the current phase,
        then <code className="text-accent">docs/02-architecture/frontend.md</code> before adding
        routes.
      </p>
    </div>
  );
}
