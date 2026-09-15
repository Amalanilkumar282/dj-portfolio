'use client';

import type { MediaImage } from '@dj/contracts';
import { useCapability } from '@dj/motion';

import { CloudinaryImage } from '../cloudinary-image';
import { usePlayer } from '../player/player-context';

import { ShaderField } from './shader-field';
import { useStage } from './stage-context';

/** Same vignette treatment the CSS/shader field uses, so overlaid type stays
 * legible whether the layer under it is a video or a static image. */
function Vignette(): React.JSX.Element {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(120% 90% at 50% 45%, transparent 35%, var(--color-bg) 100%)',
      }}
    />
  );
}

/**
 * The generative field behind the hero — plus, optionally, a real video or a
 * static hero image.
 *
 * Follows two live signals: which channel is tuned (from the switcher) and
 * whether audio is playing (from the player that already lives in the
 * marketing layout). When a track is playing the field brightens and its
 * beat swell runs at that track's real BPM — never a decorative fake tempo.
 *
 * `videoUrl` is the persona's own hero clip, set from the admin — see
 * `PersonaDetail.bgVideoUrl`. `heroImage` (`PersonaDetail.heroImage`) is the
 * fallback for personas with a photo but no clip — it fills exactly the same
 * `absolute inset-0 object-cover` box the video uses, so it crops the same
 * way on every screen instead of sitting as a small in-flow block above the
 * title. The generated field is never fully replaced by either; it plays
 * *under* them (visible while a video loads, and as the whole visual on
 * personas with neither). Video takes priority when both are set — the
 * image is the still fallback, not a second layer under the video. Video is
 * muted, looping, `playsInline` so iOS Safari doesn't take over the screen,
 * and gated on capability — a low-power device or a reduced-motion visitor
 * gets the generated field (or the static image, which has no such cost)
 * rather than an autoplaying video.
 */
export function StageBackdrop({
  videoUrl = null,
  heroImage = null,
}: { videoUrl?: string | null; heroImage?: MediaImage | null } = {}): React.JSX.Element {
  const { themeKey } = useStage();
  const { isPlaying, current } = usePlayer();
  const capability = useCapability();

  const showVideo = videoUrl !== null && capability !== 'static';
  const showImage = !showVideo && heroImage !== null;

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
          <Vignette />
        </>
      ) : null}
      {showImage ? (
        <>
          <CloudinaryImage image={heroImage} sizes="100vw" priority fill className="object-cover" />
          <Vignette />
        </>
      ) : null}
    </>
  );
}
