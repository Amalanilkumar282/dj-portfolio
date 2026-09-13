import { EventSummary, PersonaSummary, PostSummary, TrackSummary } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

/**
 * Backs `/search` (Phase 13). Deliberately not a dedicated `/api/search-
 * index` fuzzy-search endpoint — that needs its own backend query
 * strategy across every content type, a bigger piece than this page.
 * This queries the real, already-published content the API already
 * supports filtering by `q` on (tracks, events, posts, personas) — no
 * fabricated results, no client-side search index to keep in sync.
 *
 * Not cached with `React.cache()` like the other query modules: search
 * results are inherently per-request (keyed by the query string), so
 * there is no shared-fetch benefit to memoise.
 */
export async function search(q: string): Promise<{
  tracks: TrackSummary[];
  events: EventSummary[];
  posts: PostSummary[];
  personas: PersonaSummary[];
}> {
  if (!q.trim()) return { tracks: [], events: [], posts: [], personas: [] };

  const [tracks, events, posts, personas] = await Promise.all([
    apiGet('tracks', { schema: collectionSchema(TrackSummary), searchParams: { q, limit: 10 }, tags: ['tracks'] }),
    apiGet('events', {
      schema: collectionSchema(EventSummary),
      searchParams: { q, when: 'all', limit: 10 },
      tags: ['events:upcoming', 'events:past'],
    }),
    apiGet('posts', { schema: collectionSchema(PostSummary), searchParams: { q, limit: 10 }, tags: ['posts'] }),
    apiGet('personas', { schema: collectionSchema(PersonaSummary), searchParams: { q, limit: 10 }, tags: ['personas'] }),
  ]);

  return { tracks: tracks.data, events: events.data, posts: posts.data, personas: personas.data };
}
