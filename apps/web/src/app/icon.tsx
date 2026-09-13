import { ImageResponse } from 'next/og';

// `next/og`'s Satori renderer has no access to CSS custom properties — it
// renders a detached style object at the edge, outside `theme.css`. Matches
// `--color-ink-950`/`--color-accent` by hand.
/* eslint-disable dj/no-raw-color-literals */

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon(): ImageResponse {
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
    size,
  );
}
