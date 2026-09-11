import { cache } from 'react';

import { TrackDetail, TrackSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getTracks = cache(async function getTracks(options: { personaSlug?: string } = {}) {
  const result = await apiGet('tracks', {
    schema: collectionSchema(TrackSummary),
    searchParams: { personaSlug: options.personaSlug, limit: 100 },
    tags: options.personaSlug ? ['tracks', `tracks:persona:${options.personaSlug}`] : ['tracks'],
  });
  return result.data;
});

export const getFeaturedTracks = cache(async function getFeaturedTracks() {
  const result = await apiGet('tracks', {
    schema: collectionSchema(TrackSummary),
    searchParams: { featured: 'true', limit: 6 },
    tags: ['tracks:featured'],
  });
  return result.data;
});

export const getTrack = cache(async function getTrack(slug: string) {
  return apiGetOrNull(`tracks/${slug}`, {
    schema: TrackDetail,
    searchParams: { include: 'genres,streamLinks,seo' },
    tags: [`track:${slug}`],
  });
});

export const getTrackSlugs = cache(async function getTrackSlugs() {
  const result = await apiGet('tracks/slugs', { schema: slugsSchema, tags: ['tracks'], revalidate: 3600 });
  return result.data;
});
