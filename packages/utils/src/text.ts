/**
 * Text helpers used by SEO fallbacks and content previews.
 */

/**
 * Truncates at a word boundary and appends an ellipsis.
 *
 * Used for meta descriptions, where Google truncates around 155-160
 * characters anyway and a mid-word cut looks broken in the SERP.
 */
export function truncate(input: string, maxLength = 155, suffix = '…'): string {
  const text = input.trim().replace(/\s+/g, ' ');
  if (text.length <= maxLength) return text;

  const budget = maxLength - suffix.length;
  const clipped = text.slice(0, budget);
  const lastSpace = clipped.lastIndexOf(' ');

  return `${(lastSpace > budget * 0.5 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}${suffix}`;
}

/**
 * Flattens markdown to plain prose.
 *
 * Persona bios are authored in markdown; meta descriptions and OG text must
 * not contain `**` or link syntax.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, '') // bullets
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/~~(.*?)~~/g, '$1') // strikethrough
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ') // rules
    .replace(/\s+/g, ' ')
    .trim();
}

/** Average adult reading speed; rounded up so a short post never reads "0 min". */
const WORDS_PER_MINUTE = 225;

export function readingMinutes(plainText: string): number {
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
