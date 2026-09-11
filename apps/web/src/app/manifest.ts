import type { MetadataRoute } from 'next';

import { SITE } from '../lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.defaultDescription,
    start_url: '/',
    display: 'standalone',
    // The Web App Manifest spec requires a literal hex/rgb string here — it
    // is consumed by the OS install prompt, outside any CSS context, so it
    // cannot reference a custom property. Kept in sync by hand with
    // `--color-ink-950` in packages/ui/src/styles/theme.css.
    // eslint-disable-next-line dj/no-raw-color-literals
    background_color: '#15151a',
    // eslint-disable-next-line dj/no-raw-color-literals
    theme_color: '#15151a',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  };
}
