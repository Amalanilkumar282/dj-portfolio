import { cache } from 'react';

import { StatDetail } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getStats = cache(async function getStats(options: { personaSlug?: string } = {}) {
  const result = await apiGet('stats', {
    schema: collectionSchema(StatDetail),
    searchParams: { personaSlug: options.personaSlug, visibleOnly: 'true', limit: 50 },
    tags: ['stats'],
  });
  return result.data;
});
