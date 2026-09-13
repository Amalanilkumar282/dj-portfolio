import type { MediaImage } from '@dj/contracts';

/** The MediaAsset columns any image mapping needs. */
export interface MediaAssetRow {
  publicId: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  blurDataUrl: string | null;
  dominantColor: string | null;
  focalX: number | null;
  focalY: number | null;
}

/** Prisma `select` for an image. Kept in one place so no query over-fetches. */
export const MEDIA_IMAGE_SELECT = {
  publicId: true,
  width: true,
  height: true,
  altText: true,
  blurDataUrl: true,
  dominantColor: true,
  focalX: true,
  focalY: true,
} as const;

/**
 * Maps a MediaAsset row to the frontend image contract.
 *
 * Returns null when the asset is absent OR incomplete. "Incomplete" means
 * missing dimensions, alt text or a blur placeholder — and dropping such an
 * asset is deliberate rather than defensive:
 *
 * - Without `width`/`height`, `next/image` cannot reserve space and the page
 *   shifts on load, which is a direct CLS regression.
 * - Without `altText`, rendering the image would ship an accessibility
 *   failure. A database CHECK constraint already blocks this for in-page
 *   images, so hitting it here means something bypassed the normal path.
 * - Without `blurDataUrl` there is no placeholder, and the contract types it
 *   as required precisely so no consumer has to branch.
 *
 * The visible consequence is a missing image rather than a broken one, which
 * is the better failure: the legacy site rendered 20 broken artwork slots
 * because nothing checked.
 */
export function toMediaImage(asset: MediaAssetRow | null | undefined): MediaImage | null {
  if (!asset) return null;

  if (asset.width == null || asset.height == null || !asset.altText || !asset.blurDataUrl) {
    return null;
  }

  return {
    publicId: asset.publicId,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
    blurDataUrl: asset.blurDataUrl,
    dominantColor: asset.dominantColor,
    focalX: asset.focalX,
    focalY: asset.focalY,
  };
}
