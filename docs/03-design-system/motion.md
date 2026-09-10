# Motion and interaction

The differentiator, and the biggest risk. Governed by
[ADR 0013](../01-decisions/0013-cinematic-video-with-motiongate-fallbacks.md).

> ## The one rule
>
> **Every heavy effect passes through `<MotionGate>`, and its fallback is
> designed first, server-rendered, and complete on its own.**
>
> A page must be beautiful, on-brand and fast with **zero** JavaScript beyond
> the nav. The WebGL canvas fades in _over_ a CSS composition that was always
> in the HTML. If the fallback looks like a broken version of the real thing,
> the fallback is not finished.

---

## The stack, deliberately small

| Tool                               | For                                            | Notes                                                      |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Native CSS scroll-driven animation | **Default** for scroll effects                 | `animation-timeline: view()`, behind `@supports`. Zero JS. |
| `motion` (Framer v12)              | Orchestrated sequences, layout animation, drag | Only where stagger or layout projection is needed          |
| `three` + `@react-three/fiber`     | Shader backgrounds, turntable, globe           | **One shared chunk** for all three                         |
| `lenis`                            | Smooth scroll                                  | Marketing only. Never admin, never legal pages.            |
| `wavesurfer.js`                    | Waveforms                                      | Fed **precomputed peaks**, never audio                     |
| `@use-gesture/react`               | Pinch and drag in the lightbox                 | Lazy                                                       |
| `cmdk`                             | Command palette                                | Loaded on first open                                       |

`packages/motion` exports `useReducedMotion()`, `useCapability()` and
`<MotionGate>`.

```tsx
export function useCapability(): Capability {
  // Preference first — it is a stated choice, not an inference.
  const reduced = useReducedMotion();
  const mem = (navigator as NavExt).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const saveData = (navigator as NavExt).connection?.saveData ?? false;
  const coarse = matchMedia('(pointer: coarse)').matches;

  if (reduced || saveData) return 'static';
  if (mem < 4 || cores <= 4) return 'light';
  return coarse ? 'light' : 'full';
}
```

```tsx
<MotionGate
  full={<ShaderCanvas variant={persona.themeKey} />}
  light={null} /* the CSS fallback underneath is already enough */
  static={null}
/>
```

---

## The experiences

Every row has a fallback. A row without one is not shippable.

| #   | Experience                                                                                                            | Cost                                                                    | Fallback                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Cinematic scroll sequence** — full-viewport video/photo sections, page reads as a film reel                         | ~0 JS                                                                   | Poster stills with the same overlaid type. Identical composition.                                                 |
| 2   | **Persona channel switcher** — hardware selector; accent interpolates, clip crossfades, RGB-split glitch wipe         | 42KB gz, loaded on `pointerenter`/focus                                 | CSS crossfade of `next/image` posters + accent transition (~1KB). Mobile: snap-scrolled cards.                    |
| 3   | **Per-persona WebGL background** — bokeh / kaleidoscopic fractal / mono grid + scanlines / dual-portrait displacement | 95KB gz shared; DPR capped 1.25, `frameloop="demand"`, paused offscreen | CSS gradients + `mask-image` grain, **always in the HTML**                                                        |
| 4   | **3D turntable** — drag the platter to scrub the playing track                                                        | ~150KB + Draco model ≤600KB. Desktop, `deviceMemory ≥ 4` only           | Static AVIF render of the same model, with the real waveform player beneath                                       |
| 5   | **3D gig globe** — arcs to every city played                                                                          | +45KB on the shared `three` chunk                                       | 2D `react-simple-maps`, and beneath it a **crawlable list of cities with links** — better for SEO than any canvas |
| 6   | **Audio-reactive visualiser** — FFT-driven bars                                                                       | ~7KB, no lib. 30fps, DPR ≤1.5, `OffscreenCanvas` where available        | Static SVG from stored `waveformPeaks`. **Never autoplays audio.**                                                |
| 7   | **Sticky mini player + waveform** — persists across navigation                                                        | wavesurfer 24KB on first play; shell 4KB                                | Styled `<audio controls>` over the static peak SVG                                                                |
| 8   | **Scroll-driven reveals** — heading masks, `clip-path` expands, counters                                              | ~0 JS, compositor-only                                                  | `motion-ok:` → final state rendered instantly                                                                     |
| 9   | **Lenis smooth scroll**                                                                                               | 8KB                                                                     | Off under reduced motion, on touch (native momentum is better), and when `hardwareConcurrency ≤ 4`                |
| 10  | **View Transitions** — persona→persona keeps hero and title                                                           | ~0                                                                      | Instant navigation. No polyfill.                                                                                  |
| 11  | **Gesture lightbox** — pinch, swipe, drag-dismiss, filmstrip                                                          | 18KB, route-split                                                       | Hard nav to `/gallery/photo/[id]`: the same content, fully SSR, no JS                                             |
| 12  | **Marquee ticker**                                                                                                    | 0 JS                                                                    | Static, horizontally scrollable list of real links                                                                |
| 13  | **Magnetic buttons + cursor spotlight**                                                                               | 1.5KB, `(hover:hover)` only                                             | Not mounted on touch at all. Reduced motion → border glow only.                                                   |
| 14  | **Custom cursor** — morphs to PLAY / VIEW / DRAG                                                                      | 2KB                                                                     | Off on touch and reduced motion. Native cursor never hidden for keyboard users.                                   |
| 15  | **3D tilt cards**                                                                                                     | 0.8KB, CSS-only                                                         | `hover-hover:` gated; reduced motion → 2px lift                                                                   |
| 16  | **Stat counters**                                                                                                     | 0 (motion already loaded)                                               | **Final number is server-rendered**; the counter starts from it, so no CLS and no empty state                     |
| 17  | **Hero entrance** — display lines rise behind masks                                                                   | 0 JS                                                                    | Opacity 1 immediately                                                                                             |
| 18  | **Command palette `⌘K`**                                                                                              | 12KB on first open                                                      | Keyboard-native by design; `/search` is the no-JS path                                                            |
| 19  | **Grain + scroll-velocity bloom**                                                                                     | ~0                                                                      | Grain stays (static, cheap). Bloom is `motion-ok:` only, off in `forced-colors`.                                  |
| 20  | **Booking wizard micro-interactions**                                                                                 | negligible                                                              | Instant step change; success announced via `role="status"`                                                        |

---

## Hard constraints

**No scroll-jacking. Anywhere.** Sticky sections and scroll-linked crossfades
give the cinematic feel while native scroll stays untouched. Scroll-jacking is
both a Core Web Vitals and an accessibility liability, and it makes a page feel
broken on a trackpad.

**No flashing above 3Hz** (WCAG 2.3.1). The glitch wipe is explicitly capped
and skipped entirely under reduced motion.

**No text splitting in JS.** The hero entrance uses server-rendered `<span>`
per line with CSS masks. JS text splitting causes the classic CLS-and-a11y
disaster where the `<h1>` becomes 40 unrelated spans. The `<h1>` stays one
accessible string.

**Nothing autoplays with sound** (WCAG 1.4.2). Hero video is `muted`,
`aria-hidden` and decorative, and its **poster is the LCP element** so video
never delays the largest paint.

**Never animate layout properties.** `width`, `height`, `top`, `left`,
`margin`, `padding` force reflow every frame. Animate `transform`, `opacity`,
`filter` or `clip-path`. There is a lint rule.

---

## Governance

- All durations and easings come from motion tokens. **No magic numbers in
  components.**
- Framer variants live in `packages/motion/variants.ts`, not inline.
- Heavy islands are `dynamic(ssr: false)` and mount on scroll-into-view or
  first interaction — **never on load**.
- `three` is one shared chunk across items 3, 4 and 5. Importing it three ways
  triples the cost for no benefit.
- Budgets are CI gates. See [`../02-architecture/frontend.md`](../02-architecture/frontend.md).

---

## Phase 10 exit criteria

1. Every item above ships **with its documented fallback**.
2. A run with `prefers-reduced-motion: reduce` forced renders a complete,
   beautiful page with ≤60KB JS.
3. A run with `saveData` forced does the same.
4. INP ≤150ms.
5. No budget regressions.

Criteria 2 and 3 are the ones that will be tempting to skip. They are the
reason the phase exists.
