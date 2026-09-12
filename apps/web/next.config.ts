import type { NextConfig } from 'next';

/**
 * Legacy URL map.
 *
 * Mirrors `packages/db/seed/data/redirects.ts`. Static entries serve at the
 * edge with no database round trip; the `Redirect` table (read by middleware
 * in Phase 7) covers future slug changes without a deploy.
 *
 * These must not be removed — the old routes were the only indexed URLs the
 * previous site had. See docs/07-content/legacy-audit.md
 */
const legacyRedirects = [
  { source: '/bollywood', destination: '/felicitous', permanent: true },
  { source: '/psytrance', destination: '/trinitrocosmic', permanent: true },
  { source: '/techno', destination: '/tnt', permanent: true },
  { source: '/couple-duo', destination: '/felicitous-x-geetz', permanent: true },
  { source: '/discography', destination: '/music', permanent: true },
  { source: '/services/private', destination: '/services/private-parties', permanent: true },
  { source: '/collaborate', destination: '/contact', permanent: true },
];

const config: NextConfig = {
  reactStrictMode: true,

  // Server Components may import the shared TypeScript packages directly.
  transpilePackages: ['@dj/ui', '@dj/contracts', '@dj/utils'],

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31_536_000,
    // Cloudinary already does format/quality negotiation and resizing at the
    // edge; Next's built-in image endpoint would just re-do that work and
    // add a second hop. `<CloudinaryImage>` is the only sanctioned way to
    // render a `MediaImage` — see docs/02-architecture/frontend.md §5.7.
    loader: 'custom',
    loaderFile: './src/lib/cloudinary-loader.ts',
  },

  // Phase 7 enables incremental PPR on /, /[persona] and /events.
  // experimental: { ppr: 'incremental' },

  async redirects() {
    return legacyRedirects;
  },

  eslint: {
    // Linting runs as its own Turbo task, so it does not need to run twice.
    ignoreDuringBuilds: true,
  },
};

export default config;
