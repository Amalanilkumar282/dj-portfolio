import { cache } from 'react';

import { ReleaseDetail, ReleaseSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getReleases = cache(async function getReleases(options: { personaSlug?: string } = {}) {
  const result = await apiGet('releases', {
    schema: collectionSchema(ReleaseSummary),
    searchParams: { personaSlug: options.personaSlug, limit: 100 },
    tags: ['releases'],
  });
  return result.data;
});

export const getRelease = cache(async function getRelease(slug: string) {
  return apiGetOrNull(`releases/${slug}`, { schema: ReleaseDetail, tags: [`release:${slug}`] });
});

export const getReleaseSlugs = cache(async function getReleaseSlugs() {
  const result = await apiGet('releases/slugs', { schema: slugsSchema, tags: ['releases'], revalidate: 3600 });
  return result.data;
});
