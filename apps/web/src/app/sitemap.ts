import type { MetadataRoute } from 'next';

import { absoluteUrl } from '../lib/site';
import { getSitemapEntries } from '../server/queries/sitemap';

export const revalidate = 1800;

/**
 * List/index pages the API's `GET /sitemap` does not know about — it
 * aggregates published **entities**, not the static index pages that list
 * them. `lastModified` is this deploy's build time for these, since there is
 * no per-page `updatedAt` to read.
 */
const STATIC_ROUTES = [
  '/',
  '/music',
  '/events',
  '/programs',
  '/venues',
  '/about',
  '/setup',
  '/services',
  '/press',
  '/rider',
  '/testimonials',
  '/blog',
  '/faq',
  '/contact',
  '/book',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  const now = new Date();

  return [
    ...STATIC_ROUTES.map((path) => ({ url: absoluteUrl(path), lastModified: now, priority: 0.5 })),
    ...entries.map((entry) => ({
      url: entry.loc,
      lastModified: entry.lastmod,
      changeFrequency: entry.changefreq,
      priority: entry.priority,
    })),
  ];
}
