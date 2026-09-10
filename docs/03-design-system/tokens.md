# Design tokens

**Single source of truth:** `packages/ui/src/styles/theme.css`, a Tailwind v4
`@theme` block. There is no JS theme config — Tailwind v4 is CSS-first.

> The legacy site had **three** competing colour systems across
> `globals.css`, `globals-new.css` and `globals-backup.css`, plus a stale
> `tailwind.config.ts`. Components referenced tokens like `neon-pink` that
> resolved to nothing. This is the direct response to that.
>
> **Raw colour literals in `apps/*` and `packages/ui` are a lint error**
> (`dj/no-raw-color-literals`). If you are reaching for a hex value, you are
> either missing a token or about to create the fourth colour system.

---

## The architecture

Three layers. Components only ever touch the third.

### 1. Neutral ramp

A blue-cooled charcoal, not pure grey — pure grey reads cheap next to saturated
accents.

```css
--color-ink-950  /* page background */
--color-ink-900  /* surface */
--color-ink-850  /* surface raised */
--color-ink-800  /* strong border */
--color-ink-700
--color-ink-500  /* muted text — pinned at ≥4.6:1 on ink-950 */
--color-ink-300  /* secondary text */
--color-ink-100  /* body text */
--color-ink-050  /* headings */
```

All values are **OKLCH**, so lightness is perceptually uniform and the contrast
maths in `accessibility.md` actually holds.

### 2. Accent source ramps

Raw palettes. Never referenced directly by a component.

```css
--color-flame-400 / -500    /* orange  — Felicitous */
--color-rose-400  / -500    /* pink    — Felicitous, duo */
--color-violet-400 / -500   /* violet  — Trinitrocosmic */
--color-cyan-400  / -500    /* cyan    — TNT */
--color-lime-400            /* duo secondary */
```

### 3. Semantic aliases — the only layer components use

```css
--color-bg              --color-fg
--color-surface         --color-fg-strong
--color-surface-raised  --color-fg-muted
--color-border          --color-accent
--color-focus           --color-accent-strong
--color-success         --color-accent-soft
--color-danger          --color-on-accent   /* text ON an accent fill */
```

**Why the indirection.** Persona theming works by remapping semantic aliases,
never by introducing new tokens. A component written against `--color-accent`
themes itself correctly across all four personas for free. A component written
against `--color-cyan-400` is permanently TNT.

`--color-on-accent` exists because accent-on-accent is never legible; text on
an accent fill is always `ink-950`.

---

## Other token groups

**Type** — a fluid scale using `clamp()`:

```css
--text-eyebrow  /* 0.75rem, 0.18em tracking */
--text-body     /* 1.0625rem / 1.65 */
--text-lead
--text-h4 … --text-h1
--text-display  /* clamp(3.5rem, 1rem + 11vw, 11rem), line-height 0.85 */
```

**Spacing** — 4pt base, plus two named steps that carry the layout rhythm:
`--spacing-section: clamp(4rem, 8vw, 9rem)`,
`--spacing-gutter: clamp(1rem, 4vw, 3rem)`.

**Radii** — `--radius-xs` through `--radius-full`. Note TNT overrides these to
2px; sharp corners are part of that persona's industrial identity.

**Elevation** — `--shadow-sm/md/lg`, plus `--shadow-glow` which is built from
`--color-accent-soft` and therefore themes itself.

**Motion** — durations and easings live here, not as magic numbers in
components:

```css
--ease-out-quart   --duration-instant  /*  90ms */
--ease-in-out-quint --duration-fast    /* 160ms */
--ease-spring      --duration-base     /* 280ms */
                   --duration-slow     /* 520ms */
                   --duration-scene    /* 900ms */
```

---

## Reduced motion is a token-level kill switch

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 1ms;
    --duration-base: 1ms;
    --duration-slow: 1ms;
    --duration-scene: 1ms;
  }
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Driving the tokens to zero handles every component at once, rather than
requiring each one to remember. The blanket `*` rule is the backstop for
third-party CSS.

There is **also** an in-UI "Reduce motion" toggle that writes a cookie read
server-side into `data-motion="reduced"`, so a user who wants less motion
without changing an OS setting gets it before first paint (WCAG 2.2 SC 2.3.3).

---

## Base layer

```css
@layer base {
  html {
    color-scheme: dark;
    scrollbar-gutter: stable;
  }

  /* Legacy bug fixed: pinch-zoom is NEVER disabled. The old site set
     maximum-scale: 1, which is a WCAG 1.4.4 failure. */
  body {
    background: var(--color-bg);
    color: var(--color-fg);
    font-family: var(--font-sans);
  }

  :focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 3px;
  }

  ::selection {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }

  @view-transition {
    navigation: auto;
  }
}
```

`scrollbar-gutter: stable` stops layout shifting when a modal locks scroll —
a small, permanent CLS win.

---

## Custom variants

```css
@custom-variant hover-hover (@media (hover: hover) and (pointer: fine));
@custom-variant motion-ok   (@media (prefers-reduced-motion: no-preference));
```

`hover-hover:` instead of plain `hover:` for anything decorative. On touch
devices a plain `hover:` state sticks after a tap, which looks broken.

`motion-ok:` for anything that should simply not exist under reduced motion.

---

## Adding a token

Ask first: **is this genuinely new, or a variant of something that exists?**
Most requests are the second, and adding a near-duplicate is how token systems
rot.

If it is genuinely new:

1. Add it to the correct layer in `theme.css`. New colours almost always belong
   in a source ramp plus a semantic alias, not as a one-off.
2. If it is a colour, add the pairing to the contrast matrix test — a Vitest
   test iterates documented pairings with `culori` and **fails CI** below
   4.5:1 (3:1 for text ≥24px).
3. If it should differ per persona, add it to the `[data-theme]` blocks in
   [`persona-theming.md`](persona-theming.md). **All four**, or none.
4. Never define a colour only inside a media query or `[data-theme]` block.
   Bare `:root` must always have a complete definition, or a theme that does
   not override it renders with nothing.
