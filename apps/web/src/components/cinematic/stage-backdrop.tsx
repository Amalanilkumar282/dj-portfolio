'use client';

import { usePlayer } from '../player/player-context';

import { ShaderField } from './shader-field';
import { useStage } from './stage-context';

/**
 * The generative field behind the hero.
 *
 * Follows two live signals: which channel is tuned (from the switcher) and
 * whether audio is playing (from the player that already lives in the
 * marketing layout). When a track is playing the field brightens and its
 * beat swell runs at that track's real BPM — never a decorative fake tempo.
 */
export function StageBackdrop(): React.JSX.Element {
  const { themeKey } = useStage();
  const { isPlaying, current } = usePlayer();

  return (
    <ShaderField
      themeKey={themeKey ?? undefined}
      intensity={isPlaying ? 1 : 0}
      bpm={isPlaying ? (current?.bpm ?? null) : null}
    />
  );
}
