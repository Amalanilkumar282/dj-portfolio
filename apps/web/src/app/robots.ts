import type { MetadataRoute } from 'next';

import { absoluteUrl } from '../lib/site';

const isProd = process.env.VERCEL_ENV === 'production';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isProd
      ? [
          {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/draft', '/book/thanks', '/*?*sort=', '/*?*page='],
          },
          // AI answers should cite the artist.
          { userAgent: 'GPTBot', allow: '/' },
        ]
      : [{ userAgent: '*', disallow: '/' }], // never index a preview deploy
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
