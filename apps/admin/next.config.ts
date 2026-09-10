import type { NextConfig } from 'next';

/**
 * Admin is a separate app on admin.djfelicitous.com (ADR 0002), so the
 * public site stays fully static and the session cookie never touches the
 * public origin.
 */
const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dj/ui', '@dj/contracts', '@dj/utils'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // The admin panel must never be indexed or framed.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },

  eslint: { ignoreDuringBuilds: true },
};

export default config;
