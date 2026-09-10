# 0013 — Cinematic video and 3D, always behind MotionGate

**Status:** Accepted · **Date:** 2026-09-10

## Context

The brief was cinematic full-bleed video with maximum interactivity: WebGL
shader backgrounds per persona, an audio-reactive visualiser, a 3D turntable
and a 3D gig globe. The artist needs a site that visibly outclasses his
competitors.

These are also the classic way to ship a slow, inaccessible site. A DJ site
scoring 40 on mobile Lighthouse loses the wedding planner searching on a phone
on 4G — who is the highest-value visitor there is.

## Decision

Build all of it, and route **every** heavy effect through a `<MotionGate>`
component that chooses between the full experience and a static fallback based
on `prefers-reduced-motion`, `navigator.deviceMemory`, `hardwareConcurrency`,
`saveData` and pointer type.

The non-negotiable rule: **the fallback is designed first, is server-rendered,
and is complete on its own.**

- The WebGL canvas fades in over a CSS gradient-and-grain composition that is
  always present in the HTML.
- The 3D turntable falls back to a static high-quality render of the same model.
- The gig globe falls back to a 2D map and, beneath it, a crawlable list of
  cities with links — which is better for SEO than any canvas.
- The audio visualiser falls back to a static SVG drawn from stored peak data.

## Consequences

- A page is complete, on-brand and fast with **zero** JavaScript beyond the nav.
- Heavy islands are `dynamic(ssr: false)` and mount on scroll-into-view or
  first interaction, never on load. `three` is one shared chunk across the
  shader backgrounds, the turntable and the globe.
- Budgets are CI gates via `size-limit` and Lighthouse CI, not aspirations:
  ≤145KB first-load JS on `/`, LCP ≤2.0s p75, INP ≤150ms, CLS ≤0.02.
- Hero video is decorative and `aria-hidden`, and the **poster is the LCP
  element**, so video never delays the largest paint.
- No scroll-jacking anywhere. Sticky sections and scroll-linked crossfades give
  the cinematic feel while native scroll stays untouched — scroll-jacking is
  both a Core Web Vitals and an accessibility liability.
- No flashing above 3Hz; the glitch transition is capped and skipped entirely
  under reduced motion (WCAG 2.3.1).
- A persistent in-UI "Reduce motion" toggle writes a cookie read server-side,
  so the preference applies before first paint (WCAG 2.3.3).
- Cost: every effect is built twice, and the Phase 10 exit criterion requires
  proving both paths render well. This is the price of the brief, and it is
  worth paying.

## Alternatives rejected

- **Effects without fallbacks.** Fails Core Web Vitals, fails WCAG, and fails
  the actual business goal on mobile.
- **Motion-only, no WebGL.** Lighter and faster, but does not deliver the brief.
- **Feature detection alone.** Device capability, data-saver mode and user
  preference all matter, and only some of that is detectable as a "feature".
