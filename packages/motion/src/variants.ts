/**
 * Shared motion values and variants.
 *
 * Durations and easings live in theme.css as tokens, and CSS animations read
 * them directly. A JS animation library cannot — `motion` needs numbers in
 * seconds and a cubic-bezier array — so these mirror the tokens here, in one
 * place, rather than being scattered as magic numbers through components.
 * **If a token changes in theme.css, change it here too.**
 */

/** Seconds. Mirrors --duration-* in packages/ui/src/styles/theme.css. */
export const DURATION = {
  instant: 0.09,
  fast: 0.16,
  base: 0.28,
  slow: 0.52,
  scene: 0.9,
} as const;

/** Mirrors --ease-* in theme.css. */
export const EASE = {
  outQuart: [0.25, 1, 0.5, 1],
  inOutQuint: [0.83, 0, 0.17, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const;

/**
 * A line of display type rising out of a mask.
 *
 * Transform and opacity only — never height or margin, which force reflow
 * every frame (there is a lint rule).
 */
export const riseIn = {
  hidden: { y: '110%', opacity: 0 },
  visible: {
    y: '0%',
    opacity: 1,
    transition: { duration: DURATION.scene, ease: EASE.outQuart },
  },
} as const;

/** Staggers children of a section as it enters the viewport. */
export const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
} as const;

/** The default card/element reveal. Subtle on purpose; the type does the work. */
export const fadeUp = {
  hidden: { y: 24, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: DURATION.slow, ease: EASE.outQuart },
  },
} as const;
