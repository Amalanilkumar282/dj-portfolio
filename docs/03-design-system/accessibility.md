# Accessibility — WCAG 2.2 AA

Target: **WCAG 2.2 Level AA**, Lighthouse a11y 100, zero serious or critical
axe violations as a merge gate.

This is not a compliance exercise. A wedding planner using a screen reader, or
a promoter on a phone with one hand, is a paying customer.

---

## Legacy failures being fixed

| Old                                                 | Fix                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `viewport: { maximumScale: 1 }` disabled pinch-zoom | **No `maximum-scale`, no `user-scalable`.** Reflow to 320px at 400% zoom is tested. |
| No alt text on any of 33 images                     | Required by contract, by admin gate, and by a DB `CHECK` constraint                 |
| Neon palette with unchecked contrast                | OKLCH ramps + a CI contrast matrix test                                             |
| Everything client-rendered                          | Server-first, so content exists without JS                                          |

---

## Structure

One `<h1>` per page. Heading levels never skip. Real landmarks:
`<header role="banner">`, `<nav aria-label="Primary">`, `<main id="main">`,
`<footer role="contentinfo">`. Every section wrapped in
`<section aria-labelledby>`.

**Three skip links**, first in the tab order, visible on focus: _Skip to
content_, _Skip to player_, _Skip to navigation_. The player one matters
because the mini player is persistent and would otherwise sit between the nav
and the content on every page.

---

## Contrast on a neon palette — designed, not hoped

The accents are bright: cyan-400 is L≈0.85, rose-400 L≈0.75, violet-400 L≈0.72.
Bright accents are easy to use illegibly.

The rules:

- Accents appear **only** as text on `ink-950` (≥7:1), or as **fills with
  `ink-950` text on them** (≥8:1).
- **Never** accent-on-accent. **Never** accent text on `surface-raised` without
  checking.
- `--color-fg-muted` is pinned at ≥4.6:1 — not 4.5:1, to leave headroom.
- Non-text contrast (borders, focus rings, form outlines, player controls) ≥3:1.

**Enforced in CI.** A Vitest test iterates the documented token pairing matrix
with `culori` and **fails** below 4.5:1, or 3:1 for text ≥24px. Adding a colour
pairing means adding it to that matrix.

```css
@media (forced-colors: active) {
  /* Strip gradients and glows; let system colours through. */
}
@media (prefers-contrast: more) {
  /* Swap to a higher-contrast token set. */
}
```

---

## Focus

`:focus-visible` with a 2px ring at 3px offset in `--color-focus`, **plus a
dark outer ring** so it stays visible over a photograph — a single-colour ring
disappears against a busy hero image.

Radix handles dialog focus trapping and restoration
([ADR 0012](../01-decisions/0012-radix-vendored-shadcn.md)).

On route change a `RouteAnnouncer` moves focus to the new `<h1>` and updates an
`aria-live="polite"` region with the page title. App Router's default announcer
is supplemented, not trusted.

---

## WCAG 2.2 additions, specifically

These are the newer criteria that are easy to miss:

| SC                                  | Requirement                                           | How                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **2.4.11** Focus Not Obscured       | A focused element must not be hidden behind sticky UI | `scroll-padding-top` / `scroll-margin` accounting for the sticky header **and** the mini player                      |
| **2.5.7** Dragging Movements        | Any drag has a non-drag alternative                   | Lightbox drag-dismiss also has Esc and a close button. Admin drag-reorder also has "Move up"/"Move down" menu items. |
| **2.5.8** Target Size               | ≥24×24 CSS px minimum                                 | 44×44 for all primary touch targets                                                                                  |
| **3.2.6** Consistent Help           | Help in the same place on every page                  | Contact/WhatsApp affordance in the same footer and floating position sitewide                                        |
| **3.3.7** Redundant Entry           | Do not re-ask for data                                | The booking wizard never re-requests a field                                                                         |
| **3.3.8** Accessible Authentication | No cognitive puzzles                                  | Admin login supports password managers; Turnstile has a non-interactive path                                         |

---

## The audio player

The most complex a11y surface on the site.

- `role="region" aria-label="Audio player"`, real `<button>` elements.
- Play/pause uses a **label that flips** ("Play" → "Pause") rather than
  `aria-pressed`, which screen readers announce ambiguously for transport
  controls.
- Seek bar is `role="slider"` with `aria-valuemin/max/now` and a human
  `aria-valuetext`: _"1 minute 24 seconds of 6 minutes"_. `formatDurationLabel`
  in `@dj/utils` produces this.
- The **waveform canvas is `aria-hidden`** — the slider is the accessible
  interface. A canvas of bars is not information to a screen reader.
- Track changes announce via `aria-live="polite"`.
- Keyboard: Space play/pause, ←/→ ±5s, ↑/↓ volume, `M` mute, `N`/`P` track.
  Documented in a `?` dialog. The global handler **respects focus in an input
  or textarea**, or typing a booking message would pause the music.
- Nothing autoplays with sound.

## The lightbox

`aria-modal="true"`, labelled by the photo caption. Esc closes and **returns
focus to the originating thumbnail**. ←/→ navigate with an announcement
("Photo 4 of 32"). Home/End jump. Focus trapped, background `inert`.

The hard-navigation route `/gallery/photo/[id]` is the same content fully
server-rendered — so the entire experience works with no JavaScript.

---

## Forms

Visible `<label>` on every input — never placeholder-as-label.
`aria-describedby` for hints. `aria-invalid` plus `role="alert"` error text tied
by id. An **error summary at the top on submit**, with anchor links to each
field. `autocomplete` tokens on all contact fields. Never colour alone to
signal an error.

---

## Media

Videos have `<track kind="captions">`. `/videos/watch/[id]` carries a full
transcript — which is also an SEO asset. The hero loop is `aria-hidden`
decoration.

---

## Motion

Handled at the token layer plus a persistent in-UI toggle. See
[`motion.md`](motion.md) and [`tokens.md`](tokens.md).

---

## Verification

| Layer      | Tool                                                                         | Gate                               |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| Components | `vitest-axe`, `@storybook/addon-a11y`                                        | Zero violations                    |
| Routes     | `@axe-core/playwright` on **every** route                                    | Zero serious/critical blocks merge |
| Keyboard   | Scripted Playwright traversals: player, lightbox, nav, wizard, admin reorder | Part of e2e                        |
| Contrast   | `culori` matrix test                                                         | Fails CI below threshold           |
| Zoom       | 400% reflow at 320px, no 2D scrolling                                        | Playwright                         |
| No-JS      | `javaScriptEnabled: false` run — every page renders, every form submits      | Part of e2e                        |
| Manual     | NVDA + VoiceOver + keyboard-only                                             | **Phase 12 exit criterion**        |

Automated testing catches perhaps 40% of real accessibility problems. The
manual pass is not optional, and neither is the real screen-reader user review
before launch.
