'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { MotionGate, useCoarsePointer } from '@dj/motion';
import { buttonClass } from '@dj/ui/primitives';

import { usePlayer } from '../player/player-context';
import type { PlayerTrack } from '../player/player-context';
import { RhythmField } from '../player/rhythm-field';

/**
 * Act 5 — load something you weren't already looking at.
 *
 * Stands in for the venue map this slot used to hold: real coordinates for
 * three cities read as thin rather than well-travelled on a homepage, and
 * the slot is better spent on a control neither Act 3 (a flat, filterable
 * list) nor Act 4 (scrubs whatever is already loaded) already covers — a
 * browse wheel, the one control a real CDJ spends the most physical space
 * on. Every tier does the same thing (load the next/previous catalogue
 * track); only the surface it's drawn on differs.
 *
 * `dynamic(ssr: false)` keeps the `three` chunk (already paid for by Act 4
 * on this same page) out of a bundle that will never mount it. `frontend.md`'s
 * budget table exempts 3D islands to ≤200KB **desktop-gated**, and the plain
 * `hidden lg:block` Tailwind class Act 4 uses for that exemption does not
 * actually stop the import from being requested on a capable narrow-viewport
 * device — a CSS-hidden node still mounts. `useIsDesktopViewport` below
 * checks the media query itself, so a phone never even asks for the module.
 */
const BrowseScene = dynamic(() => import('./browse-scene'), { ssr: false });

function useIsDesktopViewport(): boolean {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 64rem)'); // Tailwind's `lg`
    setDesktop(query.matches);
    const onChange = (event: MediaQueryListEvent): void => { setDesktop(event.matches); };
    query.addEventListener('change', onChange);
    return () => { query.removeEventListener('change', onChange); };
  }, []);

  return desktop;
}

/**
 * Given the currently loaded index (`-1` for none) and a direction, returns
 * the index to load next — wrapping in both directions. A pure function so
 * the 3D wheel (which must step synchronously, several times, inside one
 * drag-move event, off a mutable ref rather than React state) and the flat
 * fallback (which steps once per click, off `usePlayer()`'s own state) share
 * one rule instead of two copies drifting apart.
 */
export function stepTrackIndex(length: number, index: number, direction: 1 | -1): number {
  if (length === 0) return -1;
  const base = index === -1 ? (direction === 1 ? -1 : 0) : index;
  return (base + direction + length) % length;
}

export function BrowseAct({ tracks }: { tracks: PlayerTrack[] }): React.JSX.Element | null {
  const coarse = useCoarsePointer();
  const desktop = useIsDesktopViewport();
  const eligible = useMemo(
    () => tracks.filter((track) => track.soundcloudTrackId !== null || track.audioUrl !== null),
    [tracks],
  );

  if (eligible.length === 0) return null;

  const fallback = <BrowseFallback tracks={eligible} />;
  const scene = !coarse && desktop ? <BrowseScene tracks={eligible} /> : fallback;

  return <MotionGate full={scene} light={fallback} static={fallback} />;
}

/** Cheap, no-WebGL stand-in: the mini player's own rhythm field plus the
 * same forward/back browse control the 3D wheel exposes. */
function BrowseFallback({ tracks }: { tracks: PlayerTrack[] }): React.JSX.Element {
  const { current, isPlaying, play } = usePlayer();

  function step(direction: 1 | -1): void {
    const index = current ? tracks.findIndex((track) => track.id === current.id) : -1;
    const next = tracks[stepTrackIndex(tracks.length, index, direction)];
    if (next) play(next);
  }

  return (
    <div className="border-border flex aspect-[4/3] w-full min-w-0 flex-col justify-end rounded-md border p-8">
      <RhythmField
        seed={current?.id ?? 'idle'}
        bpm={current?.bpm ?? null}
        active={isPlaying}
        className="h-24 w-full opacity-70"
      />
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => { step(-1); }}
          className={buttonClass({ variant: 'ghost', size: 'md' })}
        >
          ‹ Prev
        </button>
        <p className="text-fg-muted min-w-0 truncate text-center font-mono text-xs uppercase">
          {current ? `${current.title} · ${current.artistLabel}` : 'Browse the catalogue'}
        </p>
        <button
          type="button"
          onClick={() => { step(1); }}
          className={buttonClass({ variant: 'ghost', size: 'md' })}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
