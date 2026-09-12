import Image from 'next/image';

import type { MediaImage } from '@dj/contracts';

/**
 * The one sanctioned way to render a `MediaImage`. Wraps `next/image` with
 * the Cloudinary loader (registered in `next.config.ts`), a real blur
 * placeholder from the stored `blurDataUrl` (free at runtime — it was
 * computed once at upload), and `object-position` from the stored focal
 * point so a cropped portrait never decapitates the subject.
 */
export function CloudinaryImage({
  image,
  sizes,
  priority,
  className,
  fill,
  width,
  height,
}: {
  image: MediaImage;
  sizes: string;
  priority?: boolean;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}): React.JSX.Element {
  const objectPosition =
    image.focalX != null && image.focalY != null
      ? `${String(image.focalX * 100)}% ${String(image.focalY * 100)}%`
      : undefined;

  return (
    <Image
      src={image.publicId}
      alt={image.altText}
      sizes={sizes}
      placeholder="blur"
      blurDataURL={image.blurDataUrl}
      {...(priority ? { priority: true } : {})}
      {...(className ? { className } : {})}
      {...(objectPosition ? { style: { objectPosition } } : {})}
      {...(fill ? { fill: true } : { width: width ?? image.width, height: height ?? image.height })}
    />
  );
}
