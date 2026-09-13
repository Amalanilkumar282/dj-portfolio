import { cache } from 'react';

import { PostDetail, PostSummary, TagDetail } from '@dj/contracts';

import { apiGet, apiGetOrNull, bareListSchema, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getPosts = cache(async function getPosts(
  options: { tagSlug?: string; personaSlug?: string; limit?: number } = {},
) {
  const result = await apiGet('posts', {
    schema: collectionSchema(PostSummary),
    searchParams: {
      tagSlug: options.tagSlug,
      personaSlug: options.personaSlug,
      limit: options.limit ?? 20,
    },
    tags: ['posts'],
  });
  return result.data;
});

export const getPost = cache(async function getPost(slug: string) {
  return apiGetOrNull(`posts/${slug}`, {
    schema: PostDetail,
    searchParams: { include: 'seo' },
    tags: [`post:${slug}`],
  });
});

export const getPostSlugs = cache(async function getPostSlugs() {
  const result = await apiGet('posts/slugs', { schema: slugsSchema, tags: ['posts'], revalidate: 3600 });
  return result.data;
});

export const getTags = cache(async function getTags() {
  const result = await apiGet('tags', { schema: bareListSchema(TagDetail), tags: ['posts'] });
  return result.data;
});
