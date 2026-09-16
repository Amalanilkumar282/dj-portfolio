'use client';

import { useEffect } from 'react';

import { Spinner } from './play-button';
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
  const { current, isPlaying, isLoading, isStalled, progress, durationMs, isMuted, play, toggle, close, seek, toggleMute } =
    usePlayer();

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
      {/* Below `sm` this stacks: the button row, then seek gets its own
          full-width row underneath. `Seek`'s default styling is hidden
          below `md` (it's sized for sitting inline next to the buttons,
          which there isn't room for on a phone) — without a mobile-width
          instance of its own, the seek control simply didn't exist on a
          phone at all, which is what "the player doesn't work on mobile"
          actually was: not broken, just never rendered there. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-(--spacing-gutter) py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (isStalled) play(current);
              else toggle();
            }}
            aria-label={isStalled ? 'Playback failed — tap to retry' : isLoading ? 'Starting…' : isPlaying ? 'Pause' : 'Play'}
            aria-busy={isLoading}
            className={`touch-manipulation flex size-11 shrink-0 items-center justify-center rounded-full border transition-[color,border-color] duration-(--duration-fast) ${
              isStalled
                ? 'border-danger text-danger hover-hover:hover:bg-danger/10'
                : 'border-border bg-bg text-fg-strong hover-hover:hover:border-accent hover-hover:hover:text-accent'
            }`}
          >
            {isStalled ? (
              <span aria-hidden="true" className="text-sm">
                ⟳
              </span>
            ) : isLoading ? (
              <Spinner className="size-4" />
            ) : (
              <span aria-hidden="true" className="text-sm">
                {isPlaying ? '❚❚' : '▶'}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p aria-live="polite" className="text-fg-strong truncate text-sm font-semibold">
              {current.title}
            </p>
            <p className={`truncate text-xs ${isStalled ? 'text-danger' : 'text-fg-muted'}`}>
              {isStalled ? (
                "Couldn't start — tap to retry"
              ) : (
                <>
                  {current.artistLabel}
                  {current.bpm ? <span className="font-mono"> · {current.bpm} BPM</span> : null}
                </>
              )}
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
            className="bg-border relative hidden h-1.5 w-40 cursor-pointer rounded-full sm:block lg:w-64"
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
            className="text-fg-muted hover-hover:hover:text-fg-strong ml-auto shrink-0 text-sm sm:ml-0"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <Seek
          progress={progress}
          positionMs={positionMs}
          durationMs={durationMs}
          onSeek={seek}
          className="bg-border relative block h-1.5 w-full cursor-pointer rounded-full sm:hidden"
        />
      </div>
    </div>
  );
}
