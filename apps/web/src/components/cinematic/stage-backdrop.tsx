'use client';

import { useCapability } from '@dj/motion';

import { usePlayer } from '../player/player-context';

import { ShaderField } from './shader-field';
import { useStage } from './stage-context';

/**
 * The generative field behind the hero — plus, optionally, a real video.
 *
 * Follows two live signals: which channel is tuned (from the switcher) and
 * whether audio is playing (from the player that already lives in the
 * marketing layout). When a track is playing the field brightens and its
 * beat swell runs at that track's real BPM — never a decorative fake tempo.
 *
 * `videoUrl` is the persona's own hero clip, set from the admin — see
 * `PersonaDetail.bgVideoUrl`. The generated field is never replaced by it;
 * it plays *over* the field (which still shows through as the video loads,
 * and stays as the whole visual on personas with no clip). Muted, looping,
 * `playsInline` so iOS Safari doesn't take over the screen, and gated on
 * capability — a low-power device or a reduced-motion visitor gets the
 * generated field only, never an autoplaying video.
 */
export function StageBackdrop({ videoUrl = null }: { videoUrl?: string | null } = {}): React.JSX.Element {
  const { themeKey } = useStage();
  const { isPlaying, current } = usePlayer();
  const capability = useCapability();

  const showVideo = videoUrl !== null && capability !== 'static';

  return (
    <>
      <ShaderField
        themeKey={themeKey ?? undefined}
        intensity={isPlaying ? 1 : 0}
        bpm={isPlaying ? (current?.bpm ?? null) : null}
      />
      {showVideo ? (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            src={videoUrl}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Same vignette treatment the CSS/shader field uses, so overlaid
              type stays legible whether or not a video is present. */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(120% 90% at 50% 45%, transparent 35%, var(--color-bg) 100%)',
            }}
          />
        </>
      ) : null}
    </>
  );
}
