'use client';

import { useEffect, useRef } from 'react';

import type { VideoSummary } from '@dj/contracts';

/**
 * The video overlay, split out of `VideoRail` so it can be a lazily-loaded
 * chunk.
 *
 * Nothing here is needed until someone actually presses play, and the rail
 * itself (thumbnails, titles, durations) is the part that has to be in the
 * first load so the section is complete and crawlable on arrival. Keeping the
 * dialog in the same chunk put the whole overlay — focus handling, key
 * handling, the iframe wiring — into the first load of both `/` and
 * `/gallery` to serve a click most visitors never make.
 *
 * Mirrors `gallery/gallery-grid.tsx`'s overlay exactly — `role="dialog"
 * aria-modal`, Escape to close, arrow keys to move, a backdrop button rather
 * than a click handler on the container — so the two overlays on this site
 * behave identically.
 */
export function VideoLightbox({
  videos,
  activeIndex,
  onClose,
  onMove,
}: {
  videos: VideoSummary[];
  activeIndex: number;
  onClose: () => void;
  onMove: (next: number) => void;
}): React.JSX.Element | null {
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = videos[activeIndex];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onMove((activeIndex + 1) % videos.length);
      if (event.key === 'ArrowLeft') onMove((activeIndex - 1 + videos.length) % videos.length);
    }

    document.addEventListener('keydown', onKeyDown);
    // Move focus into the dialog, or a keyboard user is left on a control
    // behind an overlay they cannot see past.
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, videos.length, onClose, onMove]);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
      className="bg-bg/95 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      {/* The backdrop is its own button rather than a click handler on the
          container, so a click on the video itself never closes it. */}
      <button
        type="button"
        aria-label="Close video"
        className="absolute inset-0 cursor-zoom-out"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="font-display text-h4 text-fg-strong min-w-0 truncate">{active.title}</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="border-border text-fg-secondary hover-hover:hover:border-accent hover-hover:hover:text-accent shrink-0 rounded-full border px-3 py-1 text-xs uppercase"
          >
            Close
          </button>
        </div>

        <div className="border-border aspect-video overflow-hidden rounded-md border bg-black">
          {active.embedUrl ? (
            <iframe
              // `key` forces a fresh element when arrowing between videos, so
              // the previous one actually stops rather than playing on under a
              // changed src.
              key={active.id}
              src={`${active.embedUrl}?autoplay=1&rel=0`}
              title={active.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          ) : active.hostedUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- these are music sets with no dialogue to caption; where a transcript exists it is stored on the video and rendered as text, not as a caption track.
            <video src={active.hostedUrl} controls autoPlay className="h-full w-full" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
