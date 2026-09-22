import { cache } from 'react';

import { EventDetail, EventSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getUpcomingEvents = cache(async function getUpcomingEvents(
  options: { personaSlug?: string; limit?: number } = {},
) {
  const result = await apiGet('events', {
    schema: collectionSchema(EventSummary),
    searchParams: { when: 'upcoming', personaSlug: options.personaSlug, limit: options.limit ?? 50 },
    tags: ['events:upcoming'],
  });
  return result.data;
});

export const getPastEvents = cache(async function getPastEvents(
  options: { personaSlug?: string; year?: number; limit?: number } = {},
) {
  const result = await apiGet('events', {
    schema: collectionSchema(EventSummary),
    searchParams: {
      when: 'past',
      personaSlug: options.personaSlug,
      year: options.year,
      limit: options.limit ?? 50,
    },
    tags: ['events:past'],
  });
  return result.data;
});

/**
 * Shows that are on right now.
 *
 * Deliberately a separate request rather than filtering `getUpcomingEvents`
 * client-side: "upcoming" is keyed off the hourly `isPast` cron, so for up to
 * an hour after doors a live show sits in neither list. `when=live` compares
 * timestamps directly on the server.
 */
export const getLiveEvents = cache(async function getLiveEvents(
  options: { limit?: number } = {},
) {
  const result = await apiGet('events', {
    schema: collectionSchema(EventSummary),
    searchParams: { when: 'live', limit: options.limit ?? 10 },
    // Both lists, because a live show is leaving one and entering the other.
    tags: ['events:upcoming', 'events:past'],
    // Short, absolute ceiling: "happening now" is the one thing on the site
    // that goes stale on its own, with no publish event to revalidate it.
    revalidate: 300,
  });
  return result.data;
});

export const getEvent = cache(async function getEvent(slug: string) {
  return apiGetOrNull(`events/${slug}`, {
    schema: EventDetail,
    searchParams: { include: 'venue,lineup,seo' },
    tags: [`event:${slug}`],
  });
});

export const getEventSlugs = cache(async function getEventSlugs() {
  const result = await apiGet('events/slugs', {
    schema: slugsSchema,
    tags: ['events:upcoming', 'events:past'],
    revalidate: 3600,
  });
  return result.data;
});
