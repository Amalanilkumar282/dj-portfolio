'use client';

import { usePlayer, type PlayerTrack } from './player-context';

export function PlayButton({ track }: { track: PlayerTrack }): React.JSX.Element {
  const { play } = usePlayer();
  return (
    <button
      type="button"
      onClick={() => {
        play(track);
      }}
      className="bg-accent text-on-accent rounded-full px-5 py-2.5 text-sm font-semibold"
    >
      ▶ Play
    </button>
  );
}
