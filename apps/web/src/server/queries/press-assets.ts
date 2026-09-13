import { cache } from 'react';

import { PressAssetDetail } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getPressAssets = cache(async function getPressAssets() {
  const result = await apiGet('press-kit', {
    schema: collectionSchema(PressAssetDetail),
    searchParams: { limit: 50 },
    tags: ['press-kit'],
  });
  return result.data;
});
