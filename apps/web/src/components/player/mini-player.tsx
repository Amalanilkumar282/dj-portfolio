'use client';

import { AudioVisualizer } from './audio-visualizer';
import { usePlayer } from './player-context';

/**
 * Sticky bottom bar. Keyboard: Space toggles play/pause on the native
 * `<audio>` element itself (the browser already handles this once it has
 * focus); this bar adds an explicit, always-visible button for anyone who
 * tabs to it without knowing that. `role="region"` + `aria-live` on the
 * track title announce a track change to screen reader users.
 */
export function MiniPlayer(): React.JSX.Element | null {
  const { current, isPlaying, toggle, close, audioRef } = usePlayer();

  if (!current) return null;

  return (
    <div
      role="region"
      aria-label="Now playing"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t border-border bg-surface px-4 py-3"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- instrumental DJ mixes/tracks, no dialogue to caption; the accessible interface is the visible transport controls below, not the element itself */}
      <audio
        ref={audioRef}
        src={current.audioUrl}
        crossOrigin="anonymous"
        autoPlay
        onEnded={close}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="border-border bg-bg text-fg-strong flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div aria-live="polite" className="min-w-0 flex-1">
        <p className="text-fg-strong truncate text-sm font-semibold">{current.title}</p>
        <p className="text-fg-muted truncate text-xs">{current.artistLabel}</p>
      </div>
      <AudioVisualizer audioRef={audioRef} isPlaying={isPlaying} />
      <button
        type="button"
        onClick={close}
        aria-label="Close player"
        className="text-fg-muted shrink-0 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
