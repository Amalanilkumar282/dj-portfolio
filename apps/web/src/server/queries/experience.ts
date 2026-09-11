import { cache } from 'react';

import { ExperienceEntryDetail } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getExperience = cache(async function getExperience() {
  const result = await apiGet('experience', {
    schema: collectionSchema(ExperienceEntryDetail),
    searchParams: { limit: 100 },
    tags: ['experience'],
  });
  return result.data;
});
