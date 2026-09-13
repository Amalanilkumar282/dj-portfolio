# 0019 — Every publishable model carries `scheduledAt` and the `published_has_date` CHECK

**Status:** Accepted · **Date:** 2026-09-11 (during Phase 4, building Venues)

## Context

The schema's own header comment states the contract for a publishable model:
`status + publishedAt + scheduledAt`. It was not actually true for 6 of the 18
models with a `ContentStatus` column — `Venue`, `Brand`, `ExperienceEntry`,
`GearItem`, `Faq` and `PressAsset` had `status` and `publishedAt` but no
`scheduledAt`.

This surfaced while building the Venues content module: `Venue` is meant to
copy the `Personas` exemplar, which extends `BaseContentService` and its
`schedule()` method needs a column that did not exist on `Venue`.

Checking further exposed a second, worse gap. `packages/db/prisma/sql/post-migrate.sql`
declares `published_has_date` — a CHECK that a `PUBLISHED` row must carry a
`publishedAt`, which is what keeps sitemap `lastmod` and JSON-LD date fields
off `null` on a live page. It was applied to only **4 of the 18** publishable
tables: `personas`, `tracks`, `events`, `posts`. The other 14, including
`venues`, could hold `status = PUBLISHED` with `publishedAt = NULL` and
Postgres would not object. `soft-delete.int-spec.ts`'s own venue fixtures were
doing exactly that — relying on the missing constraint without knowing it,
which is how a real integration test can pass against genuinely invalid data.

Neither gap had failed anything. Both are the same shape as several earlier
findings this project has hit: an invariant stated in one place (a comment, a
masterplan) and not actually enforced everywhere it claims to be, discovered
only when something downstream depends on it being true.

## Decision

Both gaps closed for all 18 publishable models in one migration, not one
model at a time as each remaining content module gets built:

- `scheduledAt DateTime?` added to the 6 models missing it
  (`20260911051039_add_scheduled_at_to_remaining_publishable_models`).
- `{table}_published_has_date` added to the 14 tables missing it, in
  `prisma/sql/post-migrate.sql`, following the exact pattern the original 4
  used.
- `schema.int-spec.ts`'s constraint-existence list extended to all 18 names,
  per the migrations doc's own rule that a new CHECK constraint is not done
  without a test — Prisma cannot see these objects, so the test is what stands
  between a skipped post-migrate step and a database that is quietly
  permissive.
- A behavioural test added (`'rejects a PUBLISHED venue with no publishedAt'`)
  because the existence list only proves the constraint object exists, not
  that it rejects anything — the distinction that let the original 14-table
  gap go unnoticed by an existence-only test suite in the first place.
- The two test fixtures that were relying on the absence of the constraint
  (`soft-delete.int-spec.ts`'s `makeVenue`, and the duplicate-venue test in
  `schema.int-spec.ts`) now create `Venue` rows as explicit `DRAFT` — they are
  testing soft-delete and unique-constraint mechanics, not the publish
  workflow, so a status that needs no `publishedAt` is the correct fixture,
  not a workaround.

## Consequences

- Every publishable model now genuinely matches the contract the schema
  documents. The remaining Phase 4 modules (Tracks, Releases, Playlists,
  Programs, Events) and the taxonomy-adjacent Phase 6 modules built on
  `Venue`, `Brand`, `ExperienceEntry`, `GearItem`, `Faq`, `PressAsset` inherit
  a working `schedule()` and a database that rejects the bad state instead of
  storing it.
- A future publishable model must add both the column and the constraint at
  the same time it is added to the schema, or `schema.int-spec.ts`'s
  existence check fails immediately — which is now exercised across all 18,
  not 4.
- The migration is purely additive (`ADD COLUMN` on a nullable column; CHECK
  constraints that only reject a state nothing legitimate should have been in)
  and requires no backfill: every seeded `PUBLISHED` row in every affected
  table already carried a `publishedAt`, verified by re-running the full seed
  against the migrated schema.
- **Generated via `prisma migrate diff --from-migrations --to-schema-datamodel`**,
  not `prisma migrate dev`. The latter drift-checks the live database, which
  always reports drift here because `post-migrate.sql` adds objects
  (`searchVector`, the CHECK constraints themselves) outside migration
  history by design ([ADR 0015](0015-post-migrate-sql-outside-migrations.md)) —
  it would have prompted a full reset of the scratch database for no reason.
  `migrate diff` compares only the migration history to `schema.prisma`,
  which is what `migrate:check` already relies on, so the two cannot disagree.

## Alternatives considered

**Add `scheduledAt` and the CHECK only to `Venue`, deferring the other 5 until
their modules are built.** Rejected: it would mean touching the schema five
more times for the identical fix, and the five-model gap would keep failing
`schema.int-spec.ts` in a way that reads as "obviously incomplete" rather than
"intentionally deferred" — there was no reason to leave it that way once
found.

**Leave the 14-table CHECK gap alone**, since only `Venue` was blocking the
current work. Rejected: the whole point of the constraint is that a
`PUBLISHED` row without a date is not a state the application should ever be
able to reach, on any model. Fixing 1 of 14 known-missing cases while leaving
13 undocumented would itself become an undocumented deviation the next
session has no way to distinguish from "this was never needed here."
