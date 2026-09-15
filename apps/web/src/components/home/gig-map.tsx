'use client';

import { useState } from 'react';

import { INDIA_OUTLINE_PATH, project, type LatLng } from './india-outline';

export interface MapVenue {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
  capacity: number | null;
}

/**
 * Act 5 — where the residencies actually are.
 *
 * A 2.5D India rather than a 3D globe, deliberately. Seven real venues sit in
 * three cities, five of them inside Bengaluru: a globe would spend ~180KB of
 * `three` to render three dots on a sphere, and the two domestic arcs would be
 * so short the curvature would never read. Everything here is SVG — it costs
 * a few KB, scales to any screen without DPR tricks, and is crisp on a phone.
 *
 * Coordinates are the venues' **real** lat/lng from the CMS run through an
 * equirectangular projection; no pin is placed by eye.
 *
 * This is decorative in the accessibility sense — the authoritative,
 * crawlable interface is the city list rendered beside it by the server, so
 * the whole figure is `aria-hidden` and every pin has a real list counterpart.
 */
export function GigMap({ venues }: { venues: MapVenue[] }): React.JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);

  const points = venues.map((venue) => ({
    venue,
    point: project({ lat: venue.latitude, lng: venue.longitude }),
  }));

  return (
    <div className="relative">
      <svg
        viewBox="0 0 100 116"
        className="h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient id="gig-map-glow">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Depth: the same silhouette offset and dimmed, so the landmass reads
            as a plate lifted off the background rather than a flat sticker. */}
        <path
          d={INDIA_OUTLINE_PATH}
          transform="translate(1.4 2.2)"
          className="fill-accent/10"
        />
        <path
          d={INDIA_OUTLINE_PATH}
          className="fill-surface stroke-border"
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />

        {/* Arcs from the home city outward. Quadratic curves lifted above the
            straight line so two short domestic hops still read as travel. */}
        {points.slice(1).map(({ venue, point }) => {
          const origin = points[0];
          if (!origin) return null;
          const midX = (origin.point.x + point.x) / 2;
          const midY = (origin.point.y + point.y) / 2 - Math.abs(point.y - origin.point.y) * 0.4 - 4;
          return (
            <path
              key={`arc-${venue.id}`}
              d={`M ${String(origin.point.x)} ${String(origin.point.y)} Q ${String(midX)} ${String(midY)} ${String(point.x)} ${String(point.y)}`}
              fill="none"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
              className="stroke-accent/50 motion-ok:[stroke-dasharray:2_3] motion-ok:animate-[gig-arc-flow_1.4s_linear_infinite]"
            />
          );
        })}

        {points.map(({ venue, point }) => (
          <g key={venue.id} className={hovered === venue.id ? 'opacity-100' : 'opacity-90'}>
            <circle cx={point.x} cy={point.y} r={hovered === venue.id ? 5 : 3.4} fill="url(#gig-map-glow)" />
            <circle cx={point.x} cy={point.y} r={0.9} className="fill-accent" />
          </g>
        ))}
      </svg>

      {/* The interactive layer is the list, not the drawing — hovering a city
          here is what lights its pin, which keeps pointer and keyboard on the
          same control instead of inventing focusable SVG nodes. */}
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {venues.map((venue) => (
          <li key={venue.id}>
            <a
              href={`/venues/${venue.slug}`}
              onMouseEnter={() => { setHovered(venue.id); }}
              onMouseLeave={() => { setHovered(null); }}
              onFocus={() => { setHovered(venue.id); }}
              onBlur={() => { setHovered(null); }}
              className="border-border hover-hover:hover:border-accent flex min-w-0 items-baseline justify-between gap-3 rounded-sm border px-4 py-3 transition-[border-color] duration-(--duration-fast)"
            >
              {/* `truncate` on a flex child does nothing without `min-w-0` —
                  a flex item's default min-width is its content's natural
                  width, so a long venue name pushed the whole row (and with
                  it the page) wider than the viewport instead of eliding. */}
              <span className="text-fg-strong min-w-0 truncate text-sm font-semibold">{venue.name}</span>
              <span className="text-fg-muted shrink-0 font-mono text-xs uppercase">
                {venue.city}
                {venue.capacity !== null ? ` · ${String(venue.capacity)} cap` : ''}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { LatLng };
