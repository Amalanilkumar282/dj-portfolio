'use client';

/**
 * The last-resort error boundary — catches errors the root layout itself
 * throws, so it must render its own `<html>`/`<body>` since the layout that
 * would normally provide them may be the thing that failed.
 */
// Inline literal colours, not tokens, throughout this file: this boundary
// exists for the case where the root layout — and therefore the
// `theme.css` import — is itself what failed, so nothing here may depend
// on it resolving. Matches `--color-ink-950`/`--color-ink-050`/
// `--color-accent` by hand.
/* eslint-disable dj/no-raw-color-literals */

export default function GlobalError({ reset }: { error: Error; reset: () => void }): React.JSX.Element {
  return (
    <html lang="en-IN">
      <body style={{ background: '#0d0d10', color: '#f5f5f5' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ opacity: 0.8 }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#2dd4bf',
              color: '#0d0d10',
              borderRadius: '999px',
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
