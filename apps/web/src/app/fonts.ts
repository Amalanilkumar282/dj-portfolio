import { Anybody, Inter, JetBrains_Mono } from 'next/font/google';

/**
 * The three typefaces, self-hosted at build time by `next/font/google`.
 *
 * Faces are exactly the ones docs/03-design-system/typography.md specifies:
 * **Anybody** for display (named there as the primary, with Monument
 * Extended as the commercial alternative), **JetBrains Mono** for technical
 * metadata, and **Inter** for body — which that document explicitly names as
 * the open alternative to commercial Satoshi. So this is the documented
 * decision, not a substitution.
 *
 * `next/font/google` downloads and self-hosts at build: no runtime request to
 * Google, no CSP change, no binaries committed, and a typo in a family name
 * fails the build rather than silently falling back — the same property
 * `next/font/local` was chosen for.
 *
 * Each maps onto the CSS variable `theme.css` already reads, so the token
 * layer needs no change at all.
 */

/**
 * Display. Anybody carries a width axis, which is what gives the hero its
 * poster-like proportions at `--text-display` (up to 11rem, 0.85 line-height).
 * `adjustFontFallback` generates `size-adjust` metrics for the fallback face —
 * this is what keeps CLS at 0 through the swap.
 */
export const displayFont = Anybody({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-monument',
  weight: 'variable',
  axes: ['wdth'],
  adjustFontFallback: true,
});

/** Body. Neutral and highly legible small — it has to read professional to a wedding planner. */
export const sansFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-satoshi',
});

/**
 * Mono. BPM, musical keys, durations, catalogue numbers, the technical rider —
 * and TNT's display face, via the `[data-theme='tnt']` override in theme.css.
 *
 * Not preloaded: only a few surfaces need it, and preloading a third face
 * would eat the 140KB font budget for no first-paint benefit.
 */
export const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
  preload: false,
});

/** Applied together on `<html>`, so every token resolves everywhere. */
export const fontVariables = `${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`;
