'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

import type { VideoSummary } from '@dj/contracts';
import { cardClass } from '@dj/ui/primitives';
import { secondsToDuration } from '@dj/utils';

import { CloudinaryImage } from '../cloudinary-image';

import { PosterRail, PosterRailItem } from './poster-rail';

/**
 * A strip of videos, each opening in a lightbox.
 *
 * **Nothing third-party loads until the viewer presses play.** The rail shows
 * our own thumbnails; the YouTube/Vimeo iframe is mounted only inside the
 * open lightbox, and unmounted when it closes. That is the whole reason the
 * API composes a `youtube-nocookie.com` embed URL: with no iframe on the
 * page, no tracking cookie is set, no consent prompt is owed, and the page
 * does not pay for several hundred kilobytes of someone else's player just to
 * show six thumbnails.
 *
 * The overlay is a **separate, lazily-imported chunk** for the same reason at
 * the JS level: the rail has to be in the first load (it is content, and it
 * is what a crawler reads), while the dialog serves a click most visitors
 * never make. Keeping them together pushed `/gallery` past the ≤120KB
 * content-route budget in `frontend.md`.
 *
 * `ssr: false` is correct here and costs nothing: the lightbox renders only
 * after a click, so there is no server-rendered output to lose and no
 * hydration mismatch to risk.
 */
const VideoLightbox = dynamic(
  async () => (await import('./video-lightbox')).VideoLightbox,
  { ssr: false },
);

export function VideoRail({ videos }: { videos: VideoSummary[] }): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const close = useCallback(() => {
    setActiveIndex(null);
  }, []);

  return (
    <>
      <PosterRail label="Videos">
        {videos.map((video, index) => (
          <PosterRailItem key={video.id} className="w-[18rem] shrink-0 snap-start sm:w-[22rem]">
            <button
              type="button"
              onClick={() => {
                setActiveIndex(index);
              }}
              className={cardClass({
                tone: 'raised',
                interactive: true,
                className: 'block w-full overflow-hidden text-left',
              })}
            >
              <div className="relative aspect-video overflow-hidden">
                {video.thumbnail ? (
                  <CloudinaryImage
                    image={video.thumbnail}
                    sizes="(min-width: 640px) 22rem, 18rem"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-(image:--gradient-persona)" aria-hidden="true" />
                )}

                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-accent text-on-accent flex size-12 items-center justify-center rounded-full">
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="ml-0.5 size-5">
                      <path d="M4 2.5v11l9-5.5-9-5.5z" fill="currentColor" />
                    </svg>
                  </span>
                </span>

                {video.durationSec !== null ? (
                  <span className="bg-surface/90 text-fg-secondary absolute right-2 bottom-2 rounded px-1.5 py-0.5 font-mono text-xs">
                    {secondsToDuration(video.durationSec)}
                  </span>
                ) : null}
              </div>

              <p className="font-display text-h4 text-fg-strong line-clamp-2 p-4">{video.title}</p>
            </button>
          </PosterRailItem>
        ))}
      </PosterRail>

      {activeIndex !== null ? (
        <VideoLightbox
          videos={videos}
          activeIndex={activeIndex}
          onClose={close}
          onMove={setActiveIndex}
        />
      ) : null}
    </>
  );
}
