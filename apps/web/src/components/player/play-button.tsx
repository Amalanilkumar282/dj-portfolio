'use client';

import { usePlayer, type PlayerTrack } from './player-context';

/**
 * Plays a track, or toggles it if it is already the loaded one.
 *
 * Two visual weights: `solid` for a track's own detail page, `inline` for
 * the track wall where dozens sit next to each other.
 */
export function PlayButton({
  track,
  variant = 'solid',
}: {
  track: PlayerTrack;
  variant?: 'solid' | 'inline';
}): React.JSX.Element {
  const { play, toggle, current, isPlaying } = usePlayer();
  const isCurrent = current?.id === track.id;
  const playing = isCurrent && isPlaying;

  function onClick(): void {
    if (isCurrent) toggle();
    else play(track);
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        className="border-border text-fg-strong hover-hover:hover:border-accent hover-hover:hover:text-accent flex size-11 shrink-0 items-center justify-center rounded-full border transition-[color,border-color,background-color] duration-(--duration-fast) ease-(--ease-out-quart)"
      >
        <span aria-hidden="true" className="text-xs">
          {playing ? '❚❚' : '▶'}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      className="bg-accent text-on-accent hover-hover:hover:bg-accent-strong hover-hover:hover:shadow-glow motion-ok:active:scale-[0.98] inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-[transform,background-color,box-shadow] duration-(--duration-fast) ease-(--ease-out-quart)"
    >
      <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      {playing ? 'Pause' : 'Play'}
    </button>
  );
}
