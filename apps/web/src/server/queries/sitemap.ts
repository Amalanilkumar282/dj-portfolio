import { cache } from 'react';

import { SitemapResponse } from '@dj/contracts';

import { apiGet } from '../../lib/api-client';

export const getSitemapEntries = cache(async function getSitemapEntries() {
  const result = await apiGet('sitemap', { schema: SitemapResponse, tags: ['sitemap'], revalidate: 1800 });
  return result.data;
});
