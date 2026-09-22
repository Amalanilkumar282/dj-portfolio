# ADR 0024 — Rebuild the homepage around shows; retire the 3D deck and browse wheel

**Status:** Accepted
**Date:** 2026-09-22

## Context

The artist reviewed the site and asked for a homepage revamp, with hand
sketches covering: the four musical identities, a discography split by kind of
work, "Resident DJ" entries with their real date ranges, a genre list, a list
of recently played venues, a grid of gig flyers, a photo gallery, a videos
section, and a closing "Ready to experience premium audio? / Book now /
Listen now" call to action.

His stated reason is the one that matters commercially: **most people
evaluating him for a booking never open a second page.** The homepage has to
answer "who is this, what does he play, where has he played, and is he
working" before a promoter loses interest.

Measured against that, the nine-act cinematic homepage was doing well on
craft and badly on the job:

- Act 4 (`DeckAct`, a procedural 3D CDJ with a drag-to-scrub platter) and
  Act 5 (`BrowseAct`, a rotary catalogue wheel) between them occupied roughly
  a third of the scroll and pulled `three`/R3F into the `/` route. Both are
  interactions for someone who already likes the music and wants to play with
  the page — not for someone deciding whether to hire him.
- There was **no shows section at all**. The page's own doc comment recorded
  this as deliberate ("the catalogue has zero events because no real gig dates
  existed to seed"), which was honest at the time and is now precisely the gap
  the artist wants closed.
- Venues, photo galleries and video appeared nowhere on the homepage, despite
  `/venues`, `/gallery` and the (unused) `Video` model all existing.

## Decision

**The homepage is organised around the sketch, shows-first**, in this order:
hero (with the genre list and Book now / Listen now) → musical identities →
shows & flyers → discography → residencies → recently played venues → photo
gallery → videos → services → proof → closing CTA.

**`DeckAct` and `BrowseAct` are no longer imported by the homepage.** The
component files, their scenes and their fallbacks remain on disk, working and
unchanged. This follows the precedent set by
[ADR 0023](0023-remove-homepage-gig-map.md), which removed the gig map from
the same page for a related reason: a homepage element that is beautiful but
gives the wrong first impression is a cost, not a neutral.

The scroll they occupied is now the shows rails, the venue list, the gallery
strip and the video strip — and `three` leaves the `/` bundle entirely, which
pays for the images those sections add.

**Three supporting decisions** fall out of this:

1. **Shows get real ticketing phases, not a badge field.** `Event` gains
   `onSaleFrom`, `earlyBirdUntil` and `earlyBirdPriceMax`. A free-text
   "EARLY BIRD" label would have been less work and would have gone stale
   silently, still quoting a price nobody can buy. One pure function,
   `resolveShowPhase()` in `@dj/utils`, turns those dates plus `eventStatus`
   into exactly one phase, and the homepage rail, the `/events` browse, the
   event detail page and the admin preview all read it — so they cannot
   contradict each other.

2. **`/events` becomes the browse experience** rather than a new `/shows`
   route competing with it. Filters are `searchParams`-driven and resolved on
   the server, so each view is crawlable and works without JavaScript.

3. **The `Video` model goes live.** It had been in `schema.prisma` since
   Phase 1 with a `video` RBAC resource already seeded, and no module, admin
   screen or public rendering — the same state `Gallery` was found in during
   the second UX pass. It now has the full vertical slice. Embeds are
   composed server-side from a provider plus a bare id (never a pasted URL),
   and no third-party iframe mounts until a viewer presses play.

**Homepage copy and section visibility moved into `SiteSettings`** — five
copy fields and nine booleans. Deliberately *not* a drag-and-drop page
builder: section order is a design decision the page's flow depends on, while
headings and "show this or not" are content decisions that belong to the
artist. This is the project's founding requirement (the artist manages 100%
of the content) applied to the one page that matters most.

## Consequences

- **`/` no longer loads `three`.** `/[persona]` is untouched and never
  carried the deck anyway.
- `DeckAct` and `BrowseAct` are now dead code from the homepage's point of
  view. They are kept rather than deleted because they are finished, tested
  and tier-gated work, and re-mounting either on a future `/rig` or `/music`
  page is an import, not a rebuild. If a later session decides they will
  never be used, deleting them is a separate, easy change — but deleting them
  *here* would have conflated "the homepage should not lead with this" with
  "this is bad work", and only the first is true.
- **Two residency models now visibly overlap.** `Program` (named night, venue
  relation, `residencyFrom`/`residencyTo`/`isOngoing`) and `ExperienceEntry`
  (flat CV row, free-text `role`/`organisation`, `startDate`/`endDate`) both
  describe "Resident DJ at X from A to B", and nothing in the schema links
  them. The homepage prefers `Program` and merges in only those experience
  rows whose organisation is not already covered by a program, matched on
  name. **This is recorded, not resolved** — collapsing the two is a
  migration with a content-migration story attached, and the artist has real
  data in both. A future session should decide deliberately; until then, the
  deduplication in `components/home/residencies.tsx` is the seam.
- `ProgramSummary` gained `residencyFrom`/`residencyTo`, previously only on
  `ProgramDetail`. Two nullable columns the same query already loaded.
- **The hourly `isPast` cron now exists.** `schema.prisma` had documented it
  since Phase 1 and nothing had ever written the column, so every
  upcoming/past split in the app was reading a flag frozen at row-creation.
  `isPast` is additionally derived at write time, because an event backfilled
  with a past date would otherwise advertise itself as upcoming until the next
  tick — verified live, and it was doing exactly that before the fix.
- `frame-src` in the web CSP now allows `player.vimeo.com`, since the
  contract offers VIMEO as a provider and a forbidden frame fails as a silent
  blank box.
- A `Card` primitive now exists in `packages/ui`. Existing pages were **not**
  refactored onto it — only the new sections use it — so this is an addition,
  not a sweep.
