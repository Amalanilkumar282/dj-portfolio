import { cache } from 'react';

import { TestimonialDetail } from '@dj/contracts';

import { apiGet, collectionSchema } from '../../lib/api-client';

export const getTestimonials = cache(async function getTestimonials(
  options: { personaSlug?: string; limit?: number } = {},
) {
  const result = await apiGet('testimonials', {
    schema: collectionSchema(TestimonialDetail),
    searchParams: { personaSlug: options.personaSlug, limit: options.limit ?? 50 },
    tags: ['testimonials'],
  });
  return result.data;
});
