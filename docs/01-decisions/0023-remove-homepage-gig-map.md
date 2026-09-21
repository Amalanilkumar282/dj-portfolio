# ADR 0023 — Remove the gig map; replace Act 5 with a catalogue browse wheel

**Status:** Accepted
**Date:** 2026-09-21

## Context

The homepage's Act 5 ("Where the nights happen") and the equivalent "Rooms
played" section on every persona page rendered `GigMap` — a 2.5D SVG
projection of India with pins at each venue's real lat/lng, arcs drawn
outward from Bengaluru, and an accessible city list beside it. Coordinates
were real, never invented, per `brand.md`'s anti-fabrication rule.

The artist requested its removal: the real catalogue is seven venues across
three cities, five of them in Bengaluru. A map makes that count the first
thing a visitor's eye lands on, and three dots on a country outline reads as
"has barely played anywhere" rather than "has three strong residencies" —
the opposite of the impression the rest of the page is built to give. This
is a content-honesty problem a bigger map cannot fix without inventing gigs
that didn't happen, which `brand.md` already forbids.

## Decision

Removed `GigMap` and its supporting `india-outline.ts` module entirely, from
both the homepage and persona pages. `Venue.latitude`/`longitude` are kept —
they still drive the real `GeoCoordinates` JSON-LD on each venue's own page —
and `/venues` (linked from the footer and command palette) is unaffected;
only the homepage/persona-page visualisation is gone.

Replaced Act 5 on the homepage with `BrowseAct` (`components/home/
browse-act.tsx` + `browse-scene.tsx`) — a rotary "browse wheel," the one
physical control a real CDJ spends the most space on and the one interaction
neither Act 3 (a flat, filterable track list) nor Act 4 (scrubs whatever is
already loaded) already covers. Dragging it horizontally loads the next/
previous catalogue track; a `Prev`/`Next` button pair is the accessible,
keyboard-reachable route to the identical action, matching the discipline
`GigMap` itself used (a decorative visual backed by a real control, not the
only way to reach the information/action). No replacement was added to
persona pages — they never carried the 3D deck either, and adding a new 3D
island there would be a bundle-size increase nothing asked for.

**Desktop-gating done properly this time.** `frontend.md`'s budget table
exempts 3D islands to ≤200KB "desktop-gated," and the existing implementation
of that (Act 4's `hidden lg:block` Tailwind wrapper) does not actually stop
the `three` chunk from being requested on a capable narrow-viewport device —
a CSS-hidden node still mounts, and `MotionGate`'s capability check is
memory/cores, not viewport width (ADR 0022). `BrowseAct` instead checks
`window.matchMedia('(min-width: 64rem)')` in JS before ever referencing the
`dynamic(() => import('./browse-scene'), { ssr: false })` import, so the
module is never requested off a narrow screen regardless of device
capability. This is a genuine improvement over the pre-existing pattern, not
just parity with it — Act 4 was not touched to match, since that was not
asked for and is a separate, working feature.

**Every tier does the same thing.** Full tier gets the 3D wheel; light,
static, coarse-pointer and narrow-viewport all get `BrowseFallback` — the
existing `RhythmField` (cheap, canvas-free, CSS-driven) plus the identical
Prev/Next control, sharing one pure `stepTrackIndex()` helper with the 3D
scene so "what track comes next" can never drift between the two
implementations.

## Consequences

- `Venue`'s `latitude`/`longitude` fields, and `Persona.venuesPlayed`, remain
  in the API/contracts layer unchanged — only their one remaining consumer
  (venue-page JSON-LD) is now documented in code comments instead of the
  removed map.
- `docs/02-architecture/frontend.md`, `docs/03-design-system/components.md`,
  `docs/06-roadmap/masterplan.md` and `docs/06-roadmap/phases.md` had their
  `GigMap` mentions swapped for the new component so they describe what
  actually exists.
- If the real venue count grows substantially (more cities, more of the
  country), a map may become the right choice again — this ADR does not
  forbid one, it just records why today's three-city reality argued against
  it. Revisit if that changes materially.
