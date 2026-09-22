import Link from 'next/link';

import type { GallerySummary } from '@dj/contracts';
import { cardClass } from '@dj/ui/primitives';

import { CloudinaryImage } from '../cloudinary-image';

import { PosterRail, PosterRailItem } from './poster-rail';

/**
 * A strip of photo sets, each linking to its own gallery page.
 *
 * Landscape rather than the shows rail's 2:3 poster: these are photographs
 * from a night, not designed artwork, and cropping a wide crowd shot to a
 * portrait tile throws away most of the room.
 */
export function GalleryRail({ galleries }: { galleries: GallerySummary[] }): React.JSX.Element {
  return (
    <PosterRail label="Photo galleries">
      {galleries.map((gallery) => (
        <PosterRailItem key={gallery.id} className="w-[18rem] shrink-0 snap-start sm:w-[22rem]">
          <Link
            href={`/gallery/${gallery.slug}`}
            className={cardClass({
              tone: 'raised',
              interactive: true,
              className: 'block h-full overflow-hidden',
            })}
          >
            <div className="relative aspect-video overflow-hidden">
              {gallery.cover ? (
                <CloudinaryImage
                  image={gallery.cover}
                  sizes="(min-width: 640px) 22rem, 18rem"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-(image:--gradient-persona)" aria-hidden="true" />
              )}
            </div>

            <div className="p-4">
              <p className="font-display text-h4 text-fg-strong line-clamp-1">{gallery.title}</p>
              <p className="text-fg-muted mt-1 font-mono text-xs uppercase">
                {gallery.itemCount} {gallery.itemCount === 1 ? 'photo' : 'photos'}
              </p>
            </div>
          </Link>
        </PosterRailItem>
      ))}
    </PosterRail>
  );
}
