'use client';

import { usePlayer, type PlayerTrack } from './player-context';

/** A small spinning ring — shown between "pressed play" and "audio is
 * actually confirmed playing". Plain SVG + Tailwind's `animate-spin`, no
 * new dependency for something this small. */
export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`animate-spin ${className ?? 'size-3.5'}`}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Plays a track, or toggles it if it is already the loaded one.
 *
 * Two visual weights: `solid` for a track's own detail page, `inline` for
 * the track wall where dozens sit next to each other.
 *
 * Two extra states sit between the play and pause icons:
 * - **loading** — `isLoading` is true from the moment this is pressed until
 *   the transport actually confirms playback started (see
 *   `player-context.tsx`'s `play()` doc comment). Skipping this state used
 *   to mean the icon flipped to "pause" instantly on click, before any
 *   audio had actually started — indistinguishable from the button being
 *   broken on a slow connection.
 * - **stalled** — `isStalled` is true if loading never resolved within
 *   `LOAD_TIMEOUT_MS` (most commonly a mobile browser silently blocking the
 *   SoundCloud iframe's autoplay). Without this, a blocked play request
 *   left the button spinning forever with no way out; clicking it now
 *   retries from scratch.
 */
export function PlayButton({
  track,
  variant = 'solid',
}: {
  track: PlayerTrack;
  variant?: 'solid' | 'inline';
}): React.JSX.Element {
  const { play, toggle, current, isPlaying, isLoading, isStalled } = usePlayer();
  const isCurrent = current?.id === track.id;
  const playing = isCurrent && isPlaying;
  const loading = isCurrent && isLoading;
  const stalled = isCurrent && isStalled;

  function onClick(): void {
    if (stalled) play(track);
    else if (isCurrent) toggle();
    else play(track);
  }

  const label = stalled
    ? `Couldn't start ${track.title} — tap to retry`
    : loading
      ? `Starting ${track.title}…`
      : playing
        ? `Pause ${track.title}`
        : `Play ${track.title}`;

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={stalled ? label : undefined}
        aria-busy={loading}
        className={`touch-manipulation flex size-11 shrink-0 items-center justify-center rounded-full border transition-[color,border-color,background-color] duration-(--duration-fast) ease-(--ease-out-quart) ${
          stalled
            ? 'border-danger text-danger hover-hover:hover:bg-danger/10'
            : 'border-border text-fg-strong hover-hover:hover:border-accent hover-hover:hover:text-accent'
        }`}
      >
        {stalled ? (
          <span aria-hidden="true" className="text-sm">
            ⟳
          </span>
        ) : loading ? (
          <Spinner className="size-4" />
        ) : (
          <span aria-hidden="true" className="text-xs">
            {playing ? '❚❚' : '▶'}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-busy={loading}
      className={`motion-ok:active:scale-[0.98] touch-manipulation inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-[transform,background-color,box-shadow] duration-(--duration-fast) ease-(--ease-out-quart) ${
        stalled
          ? 'bg-danger/10 text-danger hover-hover:hover:bg-danger/20'
          : 'bg-accent text-on-accent hover-hover:hover:bg-accent-strong hover-hover:hover:shadow-glow'
      }`}
    >
      {stalled ? (
        <span aria-hidden="true">⟳</span>
      ) : loading ? (
        <Spinner />
      ) : (
        <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      )}
      {stalled ? 'Retry' : loading ? 'Starting…' : playing ? 'Pause' : 'Play'}
    </button>
  );
}
