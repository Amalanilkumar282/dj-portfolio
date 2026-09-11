import { cache } from 'react';

import { ServiceDetail, ServiceSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema } from '../../lib/api-client';

export const getServices = cache(async function getServices() {
  const result = await apiGet('services', {
    schema: collectionSchema(ServiceSummary),
    searchParams: { limit: 50 },
    tags: ['services'],
  });
  return result.data;
});

export const getService = cache(async function getService(slug: string) {
  return apiGetOrNull(`services/${slug}`, {
    schema: ServiceDetail,
    searchParams: { include: 'seo' },
    tags: [`service:${slug}`],
  });
});
