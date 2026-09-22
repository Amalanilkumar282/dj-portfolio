import Link from 'next/link';

import type { VenueSummary } from '@dj/contracts';

/**
 * The rooms he has actually played, as a dense list.
 *
 * The artist's own sketch drew this as a plain vertical list of venue names
 * with cities — and a list is genuinely the right form here. A map was tried
 * and removed (ADR 0023) because three cities plotted on a country outline
 * read as "has barely played anywhere"; a named list reads as a credential,
 * and every name on it is one a Bengaluru promoter will recognise. Poster
 * cards would be worse still: most venues have no logo, so the grid would be
 * mostly empty boxes.
 *
 * Columns rather than one long column, because the count is now well past
 * what the map was designed around and a single column would push everything
 * below it off the first screen.
 */
export function VenueList({ venues }: { venues: VenueSummary[] }): React.JSX.Element {
  return (
    <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {venues.map((venue) => (
        <li key={venue.id} className="min-w-0">
          <Link
            href={`/venues/${venue.slug}`}
            className="border-border/60 hover-hover:hover:text-accent text-fg-secondary flex items-baseline gap-3 border-b py-3 transition-colors duration-(--duration-fast)"
          >
            <span className="bg-accent/60 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{venue.name}</span>
            {venue.city ? (
              <span className="text-fg-muted shrink-0 font-mono text-xs uppercase">
                {venue.city}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
