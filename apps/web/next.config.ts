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

/**
 * A real Content-Security-Policy, not the full nonce-based one the
 * masterplan describes for Phase 12 — a per-request nonce needs
 * middleware wiring through every inline script (including Next's own
 * hydration payload), which is a dedicated task in its own right, not a
 * header-list addition. This is the honest intermediate step: every
 * directive is allowlisted rather than left open, `unsafe-inline` appears
 * only for styles (Tailwind's runtime + component-level `style` props have
 * no nonce path today), and there is no `unsafe-eval` anywhere.
 */
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' here is a known, deliberate weakening — not an
  // oversight. Next's App Router injects inline bootstrap/RSC-streaming
  // scripts with no nonce by default; blocking them without first wiring
  // a per-request nonce through middleware would break hydration on every
  // page, and that risk can't be caught by anything short of a real
  // browser (not available in this session). Tightening this to a nonce
  // is the very next hardening step, not something to guess at blind.
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' https://plausible.io",
  "frame-src 'self' https://challenges.cloudflare.com https://w.soundcloud.com https://open.spotify.com https://www.youtube-nocookie.com",
  "media-src 'self' https://res.cloudinary.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
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

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  eslint: {
    // Linting runs as its own Turbo task, so it does not need to run twice.
    ignoreDuringBuilds: true,
  },
};

export default config;
