import { cache } from 'react';

import { PersonaDetail, PersonaPageResponse, PersonaSummary } from '@dj/contracts';

import { apiGet, apiGetOrNull, collectionSchema, slugsSchema } from '../../lib/api-client';

export const getPersonas = cache(async function getPersonas() {
  const result = await apiGet('personas?limit=10', {
    schema: collectionSchema(PersonaSummary),
    tags: ['personas'],
  });
  return result.data;
});

export const getPersona = cache(async function getPersona(slug: string) {
  return apiGetOrNull(`personas/${slug}`, {
    schema: PersonaDetail,
    tags: [`persona:${slug}`],
  });
});

/** The full landing-page payload — one API round trip per persona page. */
export const getPersonaPage = cache(async function getPersonaPage(slug: string) {
  return apiGetOrNull(`personas/${slug}/page`, {
    schema: PersonaPageResponse,
    tags: [`persona:${slug}`, `tracks:persona:${slug}`],
  });
});

export const getPersonaSlugs = cache(async function getPersonaSlugs() {
  const result = await apiGet('personas/slugs', {
    schema: slugsSchema,
    tags: ['personas'],
    revalidate: 3600,
  });
  return result.data;
});
