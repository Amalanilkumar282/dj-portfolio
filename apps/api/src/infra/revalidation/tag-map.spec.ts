import { describe, expect, it } from 'vitest';

import type { ContentChangedEvent } from '@dj/contracts';
import { REVALIDATABLE_ENTITIES, tags } from '@dj/contracts';

import { resolveTags } from './tag-map';

/**
 * Cache-tag resolution.
 *
 * These tests exist because an asymmetry between this map and the web app's
 * query tags fails **silently** — as "I published but nothing changed" — with
 * every individual piece looking correct. There is no runtime error to catch,
 * so the guarantees have to be asserted.
 *
 * See docs/02-architecture/caching-and-revalidation.md
 */

function event(overrides: Partial<ContentChangedEvent> = {}): ContentChangedEvent {
  return {
    entity: 'track',
    id: 'abc',
    slug: 'some-slug',
    action: 'publish',
    ...overrides,
  };
}

describe('resolveTags', () => {
  it('covers every revalidatable entity', () => {
    // A new entity added to the union but not to TAG_MAP falls through to the
    // sitemap-only default and quietly never revalidates its own page. So the
    // assertion has to be "resolved something BEYOND the fallback" — merely
    // checking for a non-empty result passes on the fallback itself and the
    // test would be decorative.
    for (const entity of REVALIDATABLE_ENTITIES) {
      const resolved = resolveTags(event({ entity }));
      const beyondFallback = resolved.filter((tag) => tag !== tags.sitemap);

      expect(beyondFallback, `${entity} is missing from TAG_MAP`).not.toEqual([]);
    }
  });

  it('invalidates the entity tag, its aggregate and the sitemap', () => {
    const resolved = resolveTags(event({ entity: 'track', slug: 'neeye-melodic-remix' }));

    expect(resolved).toContain(tags.track('neeye-melodic-remix'));
    expect(resolved).toContain(tags.tracks);
    expect(resolved).toContain(tags.sitemap);
  });

  it('invalidates the owning persona page too', () => {
    // A new track has to appear on /tnt, not only on /music.
    const resolved = resolveTags(event({ entity: 'track', personaSlug: 'tnt' }));

    expect(resolved).toContain(tags.persona('tnt'));
    expect(resolved).toContain(tags.tracksByPersona('tnt'));
  });

  it('omits persona tags when the entity has no persona', () => {
    const resolved = resolveTags(event({ entity: 'track', personaSlug: undefined }));

    expect(resolved.some((tag) => tag.startsWith('persona:'))).toBe(false);
  });

  it('invalidates both event lists, because the direction is unknowable here', () => {
    // Publishing an event or flipping isPast moves it between upcoming and
    // past, and this map cannot tell which way.
    const resolved = resolveTags(event({ entity: 'event', slug: 'bolly-tech' }));

    expect(resolved).toContain(tags.eventsUpcoming);
    expect(resolved).toContain(tags.eventsPast);
  });

  it('invalidates the home page for content that appears there', () => {
    for (const entity of ['event', 'testimonial', 'service', 'brand'] as const) {
      expect(resolveTags(event({ entity })), entity).toContain(tags.home);
    }
  });

  it('invalidates nav and footer for a settings change', () => {
    // Settings touch the header, footer and default SEO on every page, so
    // this is the one entity that legitimately invalidates broadly.
    const resolved = resolveTags(event({ entity: 'settings', slug: undefined }));

    expect(resolved).toContain(tags.settings);
    expect(resolved).toContain(tags.nav);
    expect(resolved).toContain(tags.footer);
  });

  it('deduplicates and sorts, so the payload is stable', () => {
    const resolved = resolveTags(event({ entity: 'event', personaSlug: 'tnt' }));

    expect(new Set(resolved).size).toBe(resolved.length);
    expect([...resolved].sort()).toEqual(resolved);
  });

  it('drops undefined slugs rather than emitting a broken tag', () => {
    // `persona:undefined` would be a tag nothing is ever fetched under, so it
    // would look like it worked while invalidating nothing.
    const resolved = resolveTags(event({ entity: 'track', slug: undefined }));

    expect(resolved.every((tag) => !tag.includes('undefined'))).toBe(true);
  });
});
