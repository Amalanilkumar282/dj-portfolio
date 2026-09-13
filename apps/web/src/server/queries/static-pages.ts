import { cache } from 'react';

import { StaticPageDetail } from '@dj/contracts';

import { apiGetOrNull } from '../../lib/api-client';

export const getStaticPage = cache(async function getStaticPage(slug: string) {
  return apiGetOrNull(`pages/${slug}`, { schema: StaticPageDetail, tags: [`page:${slug}`] });
});
