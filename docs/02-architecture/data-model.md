# Data model

**Source of truth:** `packages/db/prisma/schema.prisma` — 48 models, 21 enums.
This document explains _why_ it looks the way it does. When they disagree, the
schema wins and this file is out of date.

Related: [ADR 0014](../01-decisions/0014-camelcase-columns.md) (naming),
[ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md) (raw DDL),
[`../05-operations/migrations.md`](../05-operations/migrations.md) (workflow).

---

## Universal conventions

Every content model carries the same five concerns. Applying them uniformly is
what makes the generic `BaseContentService` (Phase 4) and the reusable admin
editor possible.

| Concern          | Fields                                             | Enforced by                           |
| ---------------- | -------------------------------------------------- | ------------------------------------- |
| Identity         | `id` (cuid2), `slug` (unique)                      | Prisma                                |
| Soft delete      | `deletedAt`                                        | Prisma client extension               |
| Audit            | `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Prisma client extension               |
| Publish workflow | `status`, `publishedAt`, `scheduledAt`             | `publishedWhere()` + CHECK constraint |
| Ordering         | `sortIndex`                                        | manual, drag-to-reorder in admin      |
| SEO              | optional 1:1 `SeoMeta`                             | —                                     |

### Why `cuid2` and not autoincrement

Ids appear in admin URLs and in API payloads. Sequential integers leak how much
content exists and make enumeration trivial. cuid2 is short enough to read in a
URL and collision-resistant enough to generate client-side if ever needed.

### Why slug for public reads, id for admin writes

Public routes resolve by `slug`; admin endpoints mutate by `id`. **Slugs
change** — for SEO, or because a title was fixed — and ids do not. A redirect
covers the old slug; nothing needs to cover an old id.

### Why `SeoMeta` is a shared table

Postgres has no Prisma embeddable types. The alternatives were duplicating
eight columns across twelve models, or one shared table with an optional 1:1
relation. The shared table wins twice: no duplication, and the admin SEO editor
is one reusable component pointed at one shape.

### Soft delete is structural, not conventional

`packages/db/src/extensions/soft-delete.ts` rewrites `delete` and `deleteMany`
into `update`s that stamp `deletedAt`, and adds `deletedAt: null` to every read.

Two details that matter more than they look:

1. **`findUnique` is filtered too.** Prisma allows extra scalar filters on
   `findUnique` when a unique field is present. Without this, a soft-deleted
   row stays reachable by id _or slug_ — which is exactly how "deleted" content
   leaks back onto a live page.
2. **An explicit `deletedAt` filter disables the narrowing**, including one
   nested inside `AND`/`OR`/`NOT`. That is how the admin trash view lists
   recoverable rows.

The only way to issue a real `DELETE` is inside `runWithHardDelete()`, whose
sole legitimate caller is the nightly media purge.

### Audit stamping and the lazy-promise trap

`createdBy` / `updatedBy` come from `AsyncLocalStorage`, so no service method
needs an actor parameter threaded through it.

**There is a trap here, and it has already bitten once.** Prisma's
`PrismaPromise` is lazy: it does not execute until awaited. So

```ts
storage.run(ctx, () => prisma.venue.create(...))   // WRONG
```

hands an un-started promise out of the storage scope; the scope exits, the
query then runs with no context, and the audit stamp silently becomes `null`
with no error anywhere. `runWithDbContext` therefore awaits _inside_ the scope.
Regression test: `soft-delete.int-spec.ts` →
`'survives a lazily-returned PrismaPromise'`. Do not "simplify" that function.

### Publish state is a helper, not an extension

Unlike soft delete, publish state is legitimately different per caller: the
public API wants `PUBLISHED` only, admin wants everything, draft preview wants
one specific draft. Making it implicit would mean fighting the extension on
every admin query.

It is enforced instead by the **split controller layout**: every public
`*.controller.ts` composes `publishedWhere()`; `*.admin.controller.ts` does not.

`publishedWhere()` deliberately omits `deletedAt` — adding it would trip the
soft-delete extension's "caller has an opinion" check and disable that filter.

---

## The domains

### Identity and access

`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `RefreshToken`,
`AuditLog`, `IdempotencyKey`.

- `RefreshToken.familyId` tracks a rotation lineage. Reuse of an already-rotated
  token revokes the whole family — the standard stolen-token detection.
- `User.passwordChangedAt` is a global revocation stamp: bumping it invalidates
  every refresh token issued earlier, without scanning the table.
- `AuditLog.actorEmail` is denormalised so the trail survives user deletion.
- Details in [`auth-and-rbac.md`](auth-and-rbac.md).

### Media

`MediaAsset` is one row per Cloudinary asset. The fields worth explaining:

- `blurDataUrl`, `blurhash`, `dominantColor` — computed once at upload, so
  `placeholder="blur"` costs nothing at runtime and needs no `plaiceholder` pass.
- `focalX` / `focalY` — normalised 0–1, drive `object-position` so a cropped
  hero portrait never decapitates the subject.
- `waveformPeaks` — precomputed audio peaks, so wavesurfer draws a waveform
  without downloading the audio file.
- `altText` — **required for in-page images by a CHECK constraint.** The legacy
  site had none on any of its 33 images.
- The long list of reverse relations exists so the reference counter can refuse
  to delete an asset that is still in use.

### Personas

`Persona`, `Genre`, `PersonaGenre`, `SocialLink`.

`PersonaKey` is a stable programmatic handle (`TNT`) separate from the
SEO-mutable `slug` (`tnt`). Seeds and code reference the key; URLs use the slug.

`accentColor`, `accentColorSecondary` and `gradientCss` are CMS-driven theming —
they become CSS custom properties on a server-rendered wrapper, so the artist
retunes a persona without a deploy. `sections` is an ordered JSON array
describing the page narrative, so each persona can differ without a schema
change. See [ADR 0009](../01-decisions/0009-persona-dynamic-route.md).

`SocialLink.personaId` is nullable: null means a site-wide link.

### Music

`Track`, `TrackGenre`, `Playlist`, `PlaylistTrack`, `PlaylistStreamLink`,
`StreamLink`, `Release`.

- `artistLabel` is the display credit and may differ from the owning persona,
  e.g. `Trinitrocosmic / DJ Felicitous` on a collaboration.
- Third-party embeds (`soundcloudTrackId`, `embedUrl`, `embedHtml`) are **not**
  `MediaAsset`s — nothing is hosted by us. `embedHtml` is sanitised on write
  against a strict iframe allowlist and refreshed on a 30-day TTL.
- `audioId` points at a `MediaAsset` for tracks we do host.
- `playCount` / `likeCount` are hand-curated. **They must never be presented as
  live figures.** Platform API sync is Phase 13.
- `Playlist` is the "listen to my work" showcase the legacy site could not
  express. `PlaylistTrack.sortIndex` is a **`Float`** so drag-to-reorder can
  insert between two rows without renumbering the list — seeds space them by 1000.

### Events, venues, programs

`Venue`, `Event`, `EventLineupSlot`, `Program`.

The legacy site stored gigs as bare strings — `'Housefull Sunday - BigPitcher
Sarjapur'`. Splitting that into three models turns it into a linkable,
crawlable graph with real dates, tickets, `Place` schema and per-venue landing
pages.

- `Event.startsAt` is stored **UTC**; `timezone` (default `Asia/Kolkata`)
  carries the display zone so `MusicEvent` JSON-LD emits a correct IST offset.
  A bare `Z` makes Google show Indian gigs at the wrong local time.
- `Event.isPast` is maintained by an hourly cron
  (`events-past-flag.cron.ts`) **and** derived at write time. It exists so the
  "upcoming" partial index can use a boolean predicate — Postgres rejects a
  non-immutable `now()` in an index predicate outright.
  - The cron did not exist until 2026-09-22, despite this line claiming it
    did since Phase 1, so the column held whatever value the row was created
    with and every upcoming/past split was reading a frozen flag.
  - The write path derives it too, because an event entered with a past date
    (backfilling shows already played) would otherwise advertise itself as
    upcoming until the next tick.
  - Anything needing to-the-minute accuracy compares timestamps directly
    instead: `when=live` on the API, and `resolveShowPhase()` in `@dj/utils`.
- **Ticketing phases**: `onSaleFrom`, `earlyBirdUntil` and `earlyBirdPriceMax`
  are real dates and a real price, not a free-text badge — a typed-in
  "EARLY BIRD" label never stops being true on its own, and would sit on the
  public page quoting a price nobody can still buy. `resolveShowPhase()` is
  the single reader; ordering is enforced by Zod refinements on
  `EventCreateInput`.
- `venueNameOverride` / `cityOverride` cover one-off venues not worth a row.
- `EventLineupSlot.artistName` is free text with an optional `personaId`,
  because guest artists have no `Persona` row.
- `Program` models a recurring or branded night ("Bolly-Tech", "Clubbers
  Friday") and groups many events.

### Career

`ExperienceEntry` — the work timeline on `/about`.

`GearItem` — console and gear experience for `/setup`, and **the source of
truth for the technical rider**, so equipment is maintained in exactly one
place. `isRiderItem` controls what appears on `/rider`; `isPreferred`
distinguishes "CDJ-3000 preferred" from "CDJ-2000NXS2 accepted".

### Content

`Service`, `Faq`, `PressAsset`, `Post`, `PostTag`, `Tag`, `StaticPage`,
`Gallery`, `GalleryItem`, `Video`, `Testimonial`, `Brand`, `PersonaBrand`,
`Stat`.

- `Service` prices are `Decimal?` and seeded **null**. "On request" is the
  honest default; the legacy form offered USD brackets for a rupee business.
- `Faq.answer` is plain text only — `FAQPage` JSON-LD must not contain markup.
- `Post.content` is Tiptap JSON, never HTML — see
  [ADR 0010](../01-decisions/0010-tiptap-json-storage.md). `contentText` is the
  plain-text projection feeding the search vector, reading time and meta
  fallbacks.
- `Video` went live on 2026-09-22 (module, admin screen, homepage and
  `/gallery` rendering). It had sat in this schema, entirely unused, since
  Phase 1 — the same state `Gallery` was found in. `embedUrl` is **composed
  server-side** from `provider` + `providerVideoId`, never taken from a
  pasted URL, so the public renderer can hand it to an iframe without
  re-deciding whether it is safe. It has no `SeoMeta` relation, and so no
  `seo` field on its contract: videos surface inside other pages rather than
  as standalone indexable ones.
- `Testimonial.isVerified` gates `Review`/`AggregateRating` JSON-LD. All eight
  seeded testimonials are `false`. See
  [`../07-content/brand.md`](../07-content/brand.md).
- `Stat.value` is a **String** so `"10M+"` and `"500+"` render verbatim;
  `numericValue` is the animation target for the counter component.

### Engagement

`BookingInquiry`, `InquiryNote`, `NewsletterSubscriber`.

This is the model that fixes the worst legacy bug — a form that only called
`console.log`.

- `reference` is a human-quotable `INQ-2026-0042`, generated on create.
- Budget is `Decimal?` with `currency` defaulting to `INR`, and **nullable**,
  because "not sure yet" is a real answer and forcing a bracket loses leads.
- `notifiedAt` is null until the notification email is sent. The nightly retry
  cron scans on it, because a dropped notification costs a booking.
- `spamScore` comes from a heuristic (link count, all-caps ratio, disposable
  email domain). High scores go to `SPAM` without notifying.
- `ipHash` is a salted hash, never a raw IP.

### Site

`SiteSettings` (singleton, enforced by `CHECK (id = 'singleton')`), `Redirect`,
`PageView`, `DailyMetric`.

`SiteSettings` also owns the **homepage**: five nullable copy fields
(`homeHeroEyebrow`/`Headline`/`Subheadline`, `homeClosingHeadline`/
`Subheadline`, each falling back to the component's built-in string) and nine
`homeShow*` booleans controlling which sections render. Deliberately not a
page builder — section *order* is a design decision the page's flow depends
on; headings and visibility are content decisions that belong to the artist.
See [ADR 0024](../01-decisions/0024-homepage-revamp-shows-first.md).

`PageView.visitorHash` is a salted **daily** hash; raw rows are rolled into
`DailyMetric` and dropped after 90 days.

---

## Beyond the datamodel

`prisma/sql/post-migrate.sql` adds what Prisma cannot express. Full rationale in
[ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md).

**14 partial indexes** — the highest-leverage performance item in the schema.
The public site only ever reads `PUBLISHED`, non-deleted rows, so indexing that
subset turns the hot queries into index-only scans over a fraction of each
table.

**A generated `posts.searchVector`** — weighted title > excerpt > body, with a
GIN index. Absent from `schema.prisma` by design.

**12 CHECK constraints.** Each duplicates an application rule on purpose: a bug
in a service, a bad migration or a manual `psql` session then cannot leave the
database in a state that renders a broken page or emits invalid structured data.

| Constraint                          | Prevents                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| `site_settings_singleton`           | A second settings row the site would read at random       |
| `*_published_has_date` (×4)         | A live page with a null sitemap `lastmod` or JSON-LD date |
| `media_assets_image_alt_text`       | A published in-page image with no alt text                |
| `testimonials_rating_range`         | Invalid `Review` structured data                          |
| `events_time_order`                 | An event ending before it starts                          |
| `*_price_band` / `budget_band` (×3) | Inverted price or budget ranges                           |
| `experience_entries_date_order`     | A role ending before it began                             |

## Adding a model — checklist

1. Add it to `schema.prisma` with the five universal concerns above.
2. Register it in `packages/db/src/models.ts` in the relevant arrays. These are
   literal tuples on purpose: adding a model without deciding its behaviour is
   a TypeScript error, not a silent omission that ships a hard-deleting
   endpoint.
3. `pnpm db:migrate` (this chains `post-migrate`).
4. If it needs a partial index or a CHECK constraint, add it to
   `prisma/sql/post-migrate.sql` **and** assert it in `schema.int-spec.ts`.
5. Add its permissions to `seed/data/rbac.ts` (`RESOURCES`).
6. Add its cache tags to `packages/contracts/src/cache-tags.ts` and the API
   `TAG_MAP` together — they must stay symmetrical.
7. `pnpm db:migrate:check` must report no drift.
