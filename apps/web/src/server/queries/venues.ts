import { cache } from 'react';

import { VenueDetail, VenueSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getVenues = cache(async function getVenues() {
  const result = await apiGet('venues', {
    schema: collectionSchema(VenueSummary),
    searchParams: { limit: 100 },
    tags: ['venues'],
  });
  return result.data;
});

export const getVenue = cache(async function getVenue(slug: string) {
  return apiGetOrNull(`venues/${slug}`, { schema: VenueDetail, tags: [`venue:${slug}`] });
});

export const getVenueSlugs = cache(async function getVenueSlugs() {
  const result = await apiGet('venues/slugs', { schema: slugsSchema, tags: ['venues'], revalidate: 3600 });
  return result.data;
});
