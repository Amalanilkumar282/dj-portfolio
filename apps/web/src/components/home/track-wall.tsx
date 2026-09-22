'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { chipClass } from '@dj/ui/primitives';

import { PlayButton } from '../player/play-button';
import { usePlayer } from '../player/player-context';
import type { PlayerTrack } from '../player/player-context';
import { RhythmField } from '../player/rhythm-field';
import { TrackTransport } from '../player/track-transport';

export interface WallTrack extends PlayerTrack {
  type: string;
  musicalKey: string | null;
  durationSec: number | null;
  personaSlug: string | null;
  isFeatured: boolean;
  playable: boolean;
}

/** How many cards render before a "Load more" click reveals the rest — long
 * enough that a light catalogue never shows the button, short enough that a
 * full one doesn't force a long scroll to reach the page footer. */
const PAGE_SIZE = 9;

/**
 * Act 3 — the whole catalogue, playable in place.
 *
 * Designed null-first on purpose: of the 19 real tracks only four carry a
 * BPM and three a duration, and none has artwork. So the card is typographic,
 * and every metadata line is conditional rather than rendering an em dash
 * where a number should be.
 *
 * The filter is client-side over an already-loaded list — 19 rows is far too
 * few to justify a round trip, and filtering without a navigation is what
 * makes the wall feel like a deck rather than a directory. Pagination below
 * is the same idea applied to length instead of breadth: the whole catalogue
 * is still fetched and filtered in one pass, just revealed a page at a time
 * so the wall doesn't force a long scroll past everything at once.
 */
/**
 * The catalogue's own vocabulary, in the order the artist's sketch listed it.
 *
 * Derived from the `TrackType` enum but deliberately not the whole enum: MIX
 * and PODCAST exist in the schema and have no rows, and a chip reading "0"
 * makes a catalogue look thinner than it is. Any type present in the data but
 * missing from this list still shows, appended — so adding a TrackType later
 * cannot silently hide tracks.
 */
const TYPE_LABELS: Record<string, string> = {
  ORIGINAL: 'Original tracks',
  REMIX: 'Remixes',
  LIVE_SET: 'Live sets',
  COLLABORATION: 'Collaborations',
  MIX: 'Mixes',
  PODCAST: 'Podcasts',
};

const TYPE_ORDER = ['ORIGINAL', 'REMIX', 'LIVE_SET', 'COLLABORATION', 'MIX', 'PODCAST'];

export function TrackWall({
  tracks,
  personas,
  /**
   * Swaps the filter row from "which identity" to "what kind of work" — the
   * axis the homepage's discography section is organised by, per the
   * artist's own sketch. Same grid, same player wiring, one filter predicate
   * different; a separate component would have duplicated every card.
   */
  filterBy = 'persona',
}: {
  tracks: WallTrack[];
  personas: { slug: string; stageName: string }[];
  filterBy?: 'persona' | 'type';
}): React.JSX.Element {
  const [filter, setFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { current, isPlaying } = usePlayer();

  const visible = useMemo(() => {
    if (filter === null) return tracks;
    return filterBy === 'type'
      ? tracks.filter((t) => t.type === filter)
      : tracks.filter((t) => t.personaSlug === filter);
  }, [tracks, filter, filterBy]);

  const typeFacets = useMemo(() => {
    const present = [...new Set(tracks.map((t) => t.type))];
    const ordered = [
      ...TYPE_ORDER.filter((type) => present.includes(type)),
      ...present.filter((type) => !TYPE_ORDER.includes(type)),
    ];
    return ordered.map((type) => ({
      value: type,
      label: TYPE_LABELS[type] ?? type.toLowerCase().replace('_', ' '),
      count: tracks.filter((t) => t.type === type).length,
    }));
  }, [tracks]);

  const shown = visible.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < visible.length;

  function selectFilter(next: string | null): void {
    setFilter(next);
    setPage(1);
  }

  return (
    <div>
      <div
        className="mb-8 flex flex-wrap gap-2"
        role="group"
        aria-label={filterBy === 'type' ? 'Filter tracks by kind' : 'Filter tracks by persona'}
      >
        <FilterChip label="All" count={tracks.length} active={filter === null} onSelect={() => { selectFilter(null); }} />

        {filterBy === 'type'
          ? typeFacets.map((facet) => (
              <FilterChip
                key={facet.value}
                label={facet.label}
                count={facet.count}
                active={filter === facet.value}
                onSelect={() => { selectFilter(facet.value); }}
              />
            ))
          : personas.map((persona) => {
              const count = tracks.filter((t) => t.personaSlug === persona.slug).length;
              if (count === 0) return null;
              return (
                <FilterChip
                  key={persona.slug}
                  label={persona.stageName}
                  count={count}
                  active={filter === persona.slug}
                  onSelect={() => { selectFilter(persona.slug); }}
                />
              );
            })}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((track) => {
          const playing = current?.id === track.id && isPlaying;
          return (
            <li
              key={track.id}
              className={[
                'group border-border bg-surface/60 relative overflow-hidden rounded-md border p-5',
                'hover-hover:hover:border-accent transition-[border-color,background-color] duration-(--duration-fast)',
                track.isFeatured ? 'sm:col-span-2 lg:col-span-1' : '',
                playing ? 'border-accent' : '',
              ].join(' ')}
            >
              <RhythmField
                seed={track.id}
                bpm={track.bpm}
                active={playing}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-25"
              />

              <div className="relative flex items-start gap-4">
                {track.playable ? <PlayButton track={track} variant="inline" /> : null}

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/music/${track.slug}`}
                    className="text-fg-strong hover-hover:hover:text-accent block truncate font-semibold"
                  >
                    {track.title}
                  </Link>
                  <p className="text-fg-muted mt-1 truncate text-sm">{track.artistLabel}</p>

                  <p className="text-fg-muted mt-3 flex flex-wrap gap-x-3 font-mono text-xs uppercase">
                    <span>{track.type.toLowerCase().replace('_', ' ')}</span>
                    {track.bpm !== null ? <span>{track.bpm} BPM</span> : null}
                    {track.musicalKey !== null ? <span>{track.musicalKey}</span> : null}
                    {track.durationSec !== null ? <span>{formatLength(track.durationSec)}</span> : null}
                  </p>

                  {track.playable ? <TrackTransport track={track} /> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setPage((current) => current + 1);
            }}
            className={chipClass({ tone: 'muted', size: 'md', interactive: true })}
          >
            Load more ({visible.length - shown.length} left)
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatLength(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, '0')}`;
}

function FilterChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={chipClass({ tone: active ? 'solid' : 'muted', size: 'md', interactive: !active })}
    >
      {label} <span className="font-mono opacity-60">{String(count)}</span>
    </button>
  );
}
