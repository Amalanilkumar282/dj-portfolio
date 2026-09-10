# 0011 — React-PDF for the press kit, not Puppeteer

**Status:** Accepted · **Date:** 2026-09-10

## Context

Promoters expect a downloadable EPK: cover, bio, stats, photo contact sheet,
technical rider and contact details. It must be generated from live CMS data
and regenerated when the content changes.

## Decision

`@react-pdf/renderer`, running inside the API.

## Consequences

- Roughly 800ms per render and a ~2MB dependency.
- No Chromium in the container. Puppeteer would add ~300MB to the image, a
  class of memory-leak failure modes, and 5–10 second renders.
- The PDF is uploaded to Cloudinary as `resource_type: raw` and recorded as a
  versioned `PressAsset`.
- Gated downloads are served through a **signed, 7-day expiring** Cloudinary
  URL, so an email-gated press kit cannot simply be hotlinked.
- Regenerated manually from admin, and automatically (debounced ten minutes)
  when a persona's bio, stats or photos change.
- Cost: React-PDF has its own layout primitives, so the PDF cannot literally
  reuse the web components. The design tokens are shared; the layout is not.

## Alternatives rejected

- **Puppeteer / Playwright print-to-PDF.** Would let us reuse the web layout,
  at the cost of a browser in the container.
- **A client-side generator.** Cannot be regenerated on a content change and
  cannot produce a stable, versioned, shareable URL.
- **A hand-maintained PDF.** Goes stale the first time a bio changes, which is
  precisely the problem this project exists to solve.
