import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { search } from '../../../server/queries/search';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl('/search') },
};

/**
 * The non-JS path the command palette's own fallback description promises
 * (masterplan §5.6 item 18) — also useful on its own for anyone who lands
 * here directly. Real content only: see `server/queries/search.ts`.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<React.JSX.Element> {
  const { q = '' } = await searchParams;
  const results = q ? await search(q) : { tracks: [], events: [], posts: [], personas: [] };
  const hasResults =
    results.tracks.length > 0 || results.events.length > 0 || results.posts.length > 0 || results.personas.length > 0;

  return (
    <Section className="pt-24">
      <Container className="max-w-2xl">
        <SectionHeader eyebrow="Find something" title="Search" />
        <form action="/search" className="mt-6 flex gap-3">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Search tracks, events, posts, personas…"
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm text-fg-strong"
          />
          <button
            type="submit"
            className="bg-accent text-on-accent shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Search
          </button>
        </form>

        {q && !hasResults ? <p className="text-fg-muted mt-8 text-sm">No results for &ldquo;{q}&rdquo;.</p> : null}

        {results.personas.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-fg-strong font-display text-h4">Personas</h2>
            <ul className="mt-3 space-y-2">
              {results.personas.map((persona) => (
                <li key={persona.id}>
                  <Link href={`/${persona.slug}`} className="text-accent hover:underline">
                    {persona.stageName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {results.tracks.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-fg-strong font-display text-h4">Music</h2>
            <ul className="mt-3 space-y-2">
              {results.tracks.map((track) => (
                <li key={track.id}>
                  <Link href={`/music/${track.slug}`} className="text-accent hover:underline">
                    {track.title}
                  </Link>
                  <span className="text-fg-muted"> — {track.artistLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {results.events.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-fg-strong font-display text-h4">Events</h2>
            <ul className="mt-3 space-y-2">
              {results.events.map((event) => (
                <li key={event.id}>
                  <Link href={`/events/${event.slug}`} className="text-accent hover:underline">
                    {event.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {results.posts.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-fg-strong font-display text-h4">Blog</h2>
            <ul className="mt-3 space-y-2">
              {results.posts.map((post) => (
                <li key={post.id}>
                  <Link href={`/blog/${post.slug}`} className="text-accent hover:underline">
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
