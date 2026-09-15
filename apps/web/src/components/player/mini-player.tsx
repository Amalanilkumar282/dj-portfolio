'use client';

import { useEffect } from 'react';

import { usePlayer } from './player-context';
import { RhythmField } from './rhythm-field';
import { Seek } from './seek';

/** Real height of the bar below, kept as one constant rather than measured. */
const DOCK_CLEARANCE_PX = 88;

/**
 * The persistent transport bar.
 *
 * Pure UI: the provider owns the media elements, so this can render or not
 * render without affecting playback. Accessibility notes from
 * docs/03-design-system/accessibility.md, which calls the player the most
 * complex a11y surface on the site:
 *
 * - the play/pause button uses a **flipping label** rather than
 *   `aria-pressed`, which screen readers announce ambiguously for transport
 *   controls
 * - the seek control is a real `role="slider"` with a human `aria-valuetext`
 * - the visualiser canvas is `aria-hidden`; the slider is the accessible
 *   interface to position
 */
export function MiniPlayer(): React.JSX.Element | null {
  const { current, isPlaying, progress, durationMs, isMuted, toggle, close, seek, toggleMute } = usePlayer();

  // The WhatsApp/call dock (`<ContactDock>`) reads this to lift itself clear
  // of the transport bar rather than sitting underneath it — set here,
  // beside the one component that actually knows whether the bar is on
  // screen, instead of teaching the dock to guess.
  useEffect(() => {
    const root = document.documentElement;
    if (current) root.style.setProperty('--dock-clearance', `${String(DOCK_CLEARANCE_PX)}px`);
    else root.style.removeProperty('--dock-clearance');
    return () => {
      root.style.removeProperty('--dock-clearance');
    };
  }, [current]);

  if (!current) return null;

  const positionMs = durationMs * progress;

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="border-border bg-surface/90 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-(--blur-glass)"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-(--spacing-gutter) py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="border-border bg-bg text-fg-strong hover-hover:hover:border-accent hover-hover:hover:text-accent flex size-11 shrink-0 items-center justify-center rounded-full border transition-[color,border-color] duration-(--duration-fast)"
        >
          <span aria-hidden="true" className="text-sm">
            {isPlaying ? '❚❚' : '▶'}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="text-fg-strong truncate text-sm font-semibold">
            {current.title}
          </p>
          <p className="text-fg-muted truncate text-xs">
            {current.artistLabel}
            {current.bpm ? <span className="font-mono"> · {current.bpm} BPM</span> : null}
          </p>
        </div>

        <RhythmField
          seed={current.id}
          bpm={current.bpm}
          active={isPlaying}
          className="hidden h-8 w-28 sm:block"
        />

        <Seek
          progress={progress}
          positionMs={positionMs}
          durationMs={durationMs}
          onSeek={seek}
        />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="text-fg-muted hover-hover:hover:text-fg-strong shrink-0 text-sm"
        >
          <span aria-hidden="true">{isMuted ? '🔇' : '🔊'}</span>
        </button>

        <button
          type="button"
          onClick={close}
          aria-label="Close player"
          className="text-fg-muted hover-hover:hover:text-fg-strong shrink-0 text-sm"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
