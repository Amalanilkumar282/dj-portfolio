import { cache } from 'react';

import { ProgramDetail, ProgramSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getPrograms = cache(async function getPrograms() {
  const result = await apiGet('programs', {
    schema: collectionSchema(ProgramSummary),
    searchParams: { limit: 50 },
    tags: ['programs'],
  });
  return result.data;
});

export const getProgram = cache(async function getProgram(slug: string) {
  return apiGetOrNull(`programs/${slug}`, { schema: ProgramDetail, tags: [`program:${slug}`] });
});

export const getProgramSlugs = cache(async function getProgramSlugs() {
  const result = await apiGet('programs/slugs', {
    schema: slugsSchema,
    tags: ['programs'],
    revalidate: 3600,
  });
  return result.data;
});
