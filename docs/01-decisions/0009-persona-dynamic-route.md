# 0009 — Personas are one dynamic route, not four static ones

**Status:** Accepted · **Date:** 2026-09-10

## Context

The legacy site had `/bollywood`, `/psytrance`, `/techno` and `/couple-duo` as
four separate page components of roughly 600 lines each. They started as copies
and had drifted: different section orders, different stat labels, hardcoded
years, and fabricated testimonials in two of them.

## Decision

One route: `app/(marketing)/[persona]/page.tsx`, with `generateStaticParams`
returning every published persona slug. Accent colours, section order, copy and
media all come from the `Persona` row.

## Consequences

- **Static-route performance with CMS-route flexibility.** All four pages are
  prerendered at build time; a fifth persona ships with zero code.
- Drift becomes structurally impossible — there is one template.
- Per-persona identity is data: `accentColor`, `gradientCss` and a `sections`
  JSON array drive the theming and narrative order, so the artist can retune a
  persona without a deploy.
- Legacy URLs are preserved as 301 redirects, seeded in the `Redirect` table
  and mirrored as static redirects in `next.config.ts`.
- `dynamicParams = true`, so a persona published after the last build renders
  on demand rather than 404ing.
- Cost: genuinely persona-specific behaviour (the four distinct WebGL
  backgrounds) has to be selected by key rather than written inline. This is
  handled with one shader component and a `variant` uniform.

## Alternatives rejected

- **Four static routes.** Exactly what is being replaced.
- **One route with a client-side persona switcher.** Would need four personas'
  content in one payload and would give every persona the same URL.
