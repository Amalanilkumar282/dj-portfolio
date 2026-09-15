'use client';

import { usePlayer, type PlayerTrack } from './player-context';
import { Seek } from './seek';

/**
 * The extra transport row a track card grows once it's the one actually
 * playing — seek + mute, alongside the play/pause button that's already
 * there. Previously a card had only a bare play toggle; once a track
 * started, there was no way to seek or mute it without scrolling to the
 * persistent mini-player. Rendered only for the active track (`isCurrent`)
 * so idle cards stay uncluttered — mirrors how the mini-player itself only
 * ever shows for `current`.
 */
export function TrackTransport({ track }: { track: PlayerTrack }): React.JSX.Element | null {
  const { current, progress, durationMs, isMuted, seek, toggleMute } = usePlayer();
  if (current?.id !== track.id) return null;

  return (
    <div className="mt-3 flex items-center gap-2">
      <Seek
        progress={progress}
        positionMs={durationMs * progress}
        durationMs={durationMs}
        onSeek={seek}
        className="bg-border relative block h-1.5 w-full cursor-pointer rounded-full"
      />
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="text-fg-muted hover-hover:hover:text-fg-strong shrink-0 text-xs"
      >
        <span aria-hidden="true">{isMuted ? '🔇' : '🔊'}</span>
      </button>
    </div>
  );
}
