/**
 * Slug generation.
 *
 * Slugs are the public identity of every content entity, so they must be
 * stable, lowercase and ASCII. The legacy site had mixed-case asset paths
 * (`couple-1.JPG` vs `couple-1.jpg`) that broke on case-sensitive hosts;
 * normalising here keeps that class of bug out of URLs entirely.
 */

/** Characters that are meaningful in a URL path and must not survive. */
const NON_SLUG = /[^a-z0-9]+/g;

/**
 * Converts arbitrary text into a URL-safe slug.
 *
 * Diacritics are decomposed and stripped rather than transliterated, so
 * "Trinitrócosmic" becomes "trinitrocosmic" and not "trinitr-cosmic".
 */
export function slugify(input: string, maxLength = 80): string {
  const slug = input
    .normalize('NFKD')
    // Strip combining marks left behind by NFKD.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Ampersands read as "and" in a slug; dropping them merges words.
    .replace(/&/g, ' and ')
    .replace(NON_SLUG, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= maxLength) return slug;

  // Trim at a word boundary so we never end mid-word.
  const clipped = slug.slice(0, maxLength);
  const lastDash = clipped.lastIndexOf('-');
  return lastDash > maxLength * 0.6 ? clipped.slice(0, lastDash) : clipped;
}

/**
 * Appends a numeric discriminator until the slug is not taken.
 *
 * `taken` is a predicate rather than a Set so callers can hit the database
 * (`(s) => repo.existsBySlug(s)`) or an in-memory collection during seeding.
 */
export async function uniqueSlug(
  base: string,
  taken: (candidate: string) => boolean | Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const root = slugify(base);
  if (!(await taken(root))) return root;

  for (let n = 2; n <= maxAttempts; n += 1) {
    const candidate = `${root}-${String(n)}`;
    if (!(await taken(candidate))) return candidate;
  }

  throw new Error(
    `Could not derive a unique slug from "${base}" after ${String(maxAttempts)} attempts.`,
  );
}
