import { cache } from 'react';

import { GalleryDetail, GallerySummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema } from '../../lib/api-client';

export const getGalleries = cache(async function getGalleries() {
  const result = await apiGet('galleries', {
    schema: collectionSchema(GallerySummary),
    searchParams: { limit: 50 },
    tags: ['gallery'],
  });
  return result.data;
});

export const getGallery = cache(async function getGallery(slug: string) {
  return apiGetOrNull(`galleries/${slug}`, {
    schema: GalleryDetail,
    tags: [`gallery:${slug}`],
  });
});
