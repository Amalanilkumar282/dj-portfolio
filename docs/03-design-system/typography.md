# Typography

**Three self-hosted variable fonts. Total budget ≤140KB.**

> The legacy site referenced `font-orbitron` in class names on two pages but
> **never loaded Orbitron**, so it silently fell back to a system font. Using
> `next/font/local` makes a missing font file a build error rather than a
> silent downgrade.

## The three faces

| Role    | Face                                  | Why                                                                                                                                        |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Display | **Anybody** variable (`wdth`, `wght`) | Wide, brutalist, techno-poster energy. Commercial alternative: Monument Extended.                                                          |
| Body    | **Satoshi** variable                  | Geometric and neutral, excellent at small sizes, reads professional to a wedding planner. Open alternative: Inter Variable.                |
| Mono    | **JetBrains Mono** variable           | BPM, musical keys, timecodes, track metadata, the technical rider — and TNT's display face. This is the "we know electronic music" signal. |

Three files, all variable, all woff2, Latin subset with `unicode-range`
splitting.

## Loading

```ts
// apps/web/src/app/fonts.ts
export const display = localFont({
  src: [{ path: '../../public/fonts/Anybody[wdth,wght].woff2' }],
  variable: '--font-monument',
  display: 'swap',
  preload: true,
  fallback: ['Arial Black', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

export const sans = localFont({
  src: [{ path: '../../public/fonts/Satoshi-Variable.woff2' }],
  variable: '--font-satoshi',
  display: 'swap',
  preload: true,
});

export const mono = localFont({
  src: [{ path: '../../public/fonts/JetBrainsMono[wght].woff2' }],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
});
```

Display and body are preloaded. Mono is not, because only the rider, track
metadata and TNT pages need it.

`adjustFontFallback` generates `size-adjust` metrics so the fallback occupies
the same space as the real face. **This is what keeps CLS at 0** during the
swap — without it, every heading reflows when the font arrives.

## The scale

Fluid, defined in `theme.css`. See [`tokens.md`](tokens.md).

```css
--text-eyebrow  /* 0.75rem, line-height 1, 0.18em tracking */
--text-body     /* 1.0625rem / 1.65 */
--text-lead     /* 1.25rem / 1.55 */
--text-h4       /* clamp(1.25rem, 1rem + 1vw, 1.5rem) */
--text-h3       /* clamp(1.5rem, 1.1rem + 1.6vw, 2rem) */
--text-h2       /* clamp(2rem, 1.4rem + 2.8vw, 3.25rem) */
--text-h1       /* clamp(2.75rem, 1.6rem + 5vw, 5rem) */
--text-display  /* clamp(3.5rem, 1rem + 11vw, 11rem), lh 0.85, -0.03em */
```

`--text-display` reaches 11rem with `line-height: 0.85` because the cinematic
aesthetic depends on genuinely large, tightly-tracked type. At that size a
default line-height leaves the lines floating apart.

`clamp()` throughout means there are no typography breakpoints to maintain.

## Rules

1. **Body text uses `rem`**, never `px`, so it honours browser font-size
   settings.
2. **`--text-display` is for hero headlines only.** It is not the size you
   reach for because something should be big.
3. **Mono carries meaning**, not decoration: BPM, key, duration, timecode,
   catalogue number, technical spec.
4. **Never letter-space lowercase body text** — it reads as broken.
   `--text-eyebrow` is uppercase, which is why it can carry 0.18em.
5. **Line length 60–75 characters** for prose. The `Container` component and
   `--spacing-gutter` handle this; do not put long prose in a full-bleed
   section.
6. TNT overrides `--font-display` to the mono face. **Never hardcode a font
   family in a component** — that override is exactly why.
