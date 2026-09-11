import { cache } from 'react';

import { GearItemDetail } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getGear = cache(async function getGear() {
  const result = await apiGet('gear', {
    schema: collectionSchema(GearItemDetail),
    searchParams: { limit: 100 },
    tags: ['gear'],
  });
  return result.data;
});

export const getRiderGear = cache(async function getRiderGear() {
  const result = await apiGet('gear', {
    schema: collectionSchema(GearItemDetail),
    searchParams: { riderOnly: 'true', limit: 100 },
    tags: ['gear'],
  });
  return result.data;
});
