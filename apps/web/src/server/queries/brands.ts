import { cache } from 'react';

import { BrandSummary } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getBrands = cache(async function getBrands() {
  const result = await apiGet('brands', {
    schema: collectionSchema(BrandSummary),
    searchParams: { limit: 50 },
    tags: ['brands'],
  });
  return result.data;
});
