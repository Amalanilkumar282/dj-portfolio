'use client';

import { useEffect, useState } from 'react';

import type { MediaImage } from '@dj/contracts';

import { CloudinaryImage } from '../cloudinary-image';

export interface GalleryGridItem {
  id: string;
  image: MediaImage;
  caption: string | null;
}

/**
 * The gallery's masonry grid, plus a click-to-expand lightbox over it.
 *
 * The grid itself was already server-rendered fine; only the lightbox needs
 * a client island, so this component owns both rather than splitting into
 * a server grid + a client overlay that has to duplicate the item list.
 * Follows the same overlay pattern `CommandPalette` already established:
 * `fixed inset-0` backdrop button to close, `role="dialog" aria-modal`,
 * Escape to close, nothing rendered in the DOM until it's actually open.
 */
export function GalleryGrid({ items }: { items: GalleryGridItem[] }): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex !== null ? items[activeIndex] : undefined;

  useEffect(() => {
    if (activeIndex === null) return;

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index === null ? null : (index + 1) % items.length));
      if (event.key === 'ArrowLeft') {
        setActiveIndex((index) => (index === null ? null : (index - 1 + items.length) % items.length));
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, items.length]);

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {items.map((item, index) => (
          <figure key={item.id} className="overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => {
                setActiveIndex(index);
              }}
              className="hover-hover:hover:opacity-90 block w-full cursor-zoom-in"
              aria-label={`Expand photo${item.caption ? `: ${item.caption}` : ''}`}
            >
              <CloudinaryImage
                image={item.image}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                width={item.image.width}
                height={item.image.height}
                className="w-full"
              />
            </button>
            {item.caption ? (
              <figcaption className="text-fg-muted bg-surface p-3 text-xs">{item.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10">
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              setActiveIndex(null);
            }}
            className="absolute inset-0 bg-black/85"
          />

          <div role="dialog" aria-modal="true" aria-label="Photo" className="relative flex max-h-full max-w-full flex-col items-center">
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setActiveIndex(null);
              }}
              className="text-fg-strong bg-surface/80 hover-hover:hover:bg-surface absolute -top-2 right-0 z-10 rounded-full p-2 text-xl leading-none sm:top-0 sm:-right-12"
            >
              ✕
            </button>

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => {
                    setActiveIndex((index) => (index === null ? null : (index - 1 + items.length) % items.length));
                  }}
                  className="text-fg-strong bg-surface/80 hover-hover:hover:bg-surface absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full p-2 text-xl leading-none sm:left-4"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => {
                    setActiveIndex((index) => (index === null ? null : (index + 1) % items.length));
                  }}
                  className="text-fg-strong bg-surface/80 hover-hover:hover:bg-surface absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full p-2 text-xl leading-none sm:right-4"
                >
                  ›
                </button>
              </>
            ) : null}

            <CloudinaryImage
              image={active.image}
              sizes="92vw"
              width={active.image.width}
              height={active.image.height}
              priority
              className="max-h-[80svh] w-auto max-w-full rounded-md object-contain"
            />
            {active.caption ? <p className="text-fg-secondary mt-3 max-w-prose text-center text-sm">{active.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
