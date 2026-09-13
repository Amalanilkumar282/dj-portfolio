/**
 * `next/image`'s custom loader — registered via `images.loaderFile` in
 * `next.config.ts`. `src` is always a Cloudinary `publicId` in this app;
 * every `<CloudinaryImage>` enforces that (see `components/cloudinary-image.tsx`).
 */
export default function cloudinaryLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return src;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_limit,w_${String(width)},dpr_auto/${src}`;
}
