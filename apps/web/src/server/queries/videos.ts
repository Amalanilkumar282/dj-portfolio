import { cache } from 'react';

import { VideoDetail, VideoSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

/**
 * Tags here must match `TAG_MAP.video` in the API exactly — an asymmetry
 * between the two fails silently as "I published but nothing changed", with
 * every individual piece looking correct. See
 * docs/02-architecture/caching-and-revalidation.md.
 */

export const getVideos = cache(async function getVideos(
  options: { personaSlug?: string; eventSlug?: string; featured?: boolean; limit?: number } = {},
) {
  const result = await apiGet('videos', {
    schema: collectionSchema(VideoSummary),
    searchParams: {
      personaSlug: options.personaSlug,
      eventSlug: options.eventSlug,
      featured: options.featured,
      limit: options.limit ?? 50,
    },
    tags: ['videos'],
  });
  return result.data;
});

export const getVideo = cache(async function getVideo(slug: string) {
  return apiGetOrNull(`videos/${slug}`, {
    schema: VideoDetail,
    tags: [`video:${slug}`],
  });
});

export const getVideoSlugs = cache(async function getVideoSlugs() {
  const result = await apiGet('videos/slugs', {
    schema: slugsSchema,
    tags: ['videos'],
    revalidate: 3600,
  });
  return result.data;
});
