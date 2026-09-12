/**
 * Cloudinary URL construction.
 *
 * A dedicated `packages/media` (per the masterplan) is deferred until
 * `apps/admin` also needs it (Phase 11) — see STATUS.md. Everything here is
 * a pure function, no React, so hoisting it into a package later is a file
 * move, not a rewrite.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** `sizes` presets — never hand-write a `sizes` string at a call site. */
export const SIZES = {
  heroFull: '100vw',
  half: '(min-width: 768px) 50vw, 100vw',
  cardGrid3: '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  cardGrid4: '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
  thumb64: '64px',
} as const;

/**
 * Builds a delivery URL for a Cloudinary `publicId`.
 *
 * `f_auto,q_auto` let Cloudinary pick the best format/quality per browser;
 * `c_limit` never upscales; `dpr_auto` serves the right density for retina
 * displays without the caller doing that math.
 */
export function cloudinaryUrl(publicId: string, { width, height }: { width: number; height?: number }): string {
  if (!CLOUD_NAME) {
    // No real Cloudinary account configured yet — return the id unchanged
    // rather than a URL that resolves nowhere, so a missing env var fails
    // as a broken image (visibly, in devtools) rather than as a crash here.
    return publicId;
  }
  const transform = ['f_auto', 'q_auto', 'c_limit', `w_${String(width)}`, height ? `h_${String(height)}` : null, 'dpr_auto']
    .filter(Boolean)
    .join(',');
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

/** The Open Graph crop — fixed 1200×630, not `c_limit`, since OG consumers expect an exact size. */
export function cloudinaryOgUrl(publicId: string): string {
  if (!CLOUD_NAME) return publicId;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,w_1200,h_630/${publicId}`;
}
