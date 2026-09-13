import { ImageResponse } from 'next/og';

/**
 * A real handler for the browser's automatic `/favicon.ico` request.
 *
 * `icon.tsx` already generates a favicon via Next's metadata convention and
 * is referenced by a `<link rel="icon">` tag — but browsers request
 * `/favicon.ico` directly regardless of what the page's `<head>` says, and
 * with no static file at that literal path the request used to fall through
 * to the `[persona]` dynamic segment, which tried (and failed) to look up a
 * persona named "favicon.ico". Serving a real response here removes that
 * request from the dynamic route entirely.
 *
 * Same mark as `icon.tsx`, kept in sync by hand — see that file's comment
 * for why the colours are literals rather than CSS custom properties.
 */
/* eslint-disable dj/no-raw-color-literals */

export function GET(): Response {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0d10',
          color: '#2dd4bf',
          fontSize: 20,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        F
      </div>
    ),
    { width: 32, height: 32 },
  );
}
