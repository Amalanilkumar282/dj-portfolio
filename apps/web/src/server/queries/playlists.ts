import { cache } from 'react';

import { PlaylistDetail, PlaylistSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getPlaylists = cache(async function getPlaylists(options: { personaSlug?: string } = {}) {
  const result = await apiGet('playlists', {
    schema: collectionSchema(PlaylistSummary),
    searchParams: { personaSlug: options.personaSlug, limit: 100 },
    tags: ['playlists'],
  });
  return result.data;
});

export const getPlaylist = cache(async function getPlaylist(slug: string) {
  return apiGetOrNull(`playlists/${slug}`, { schema: PlaylistDetail, tags: [`playlist:${slug}`] });
});

export const getPlaylistSlugs = cache(async function getPlaylistSlugs() {
  const result = await apiGet('playlists/slugs', {
    schema: slugsSchema,
    tags: ['playlists'],
    revalidate: 3600,
  });
  return result.data;
});
