import { cache } from 'react';

import { FaqDetail } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getFaqs = cache(async function getFaqs(options: { serviceSlug?: string } = {}) {
  const result = await apiGet('faqs', {
    schema: collectionSchema(FaqDetail),
    searchParams: { serviceSlug: options.serviceSlug, limit: 100 },
    tags: ['faqs'],
  });
  return result.data;
});
