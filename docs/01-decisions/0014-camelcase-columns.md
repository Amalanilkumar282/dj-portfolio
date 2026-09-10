# 0014 — Prisma-default camelCase columns; snake_case table names only

**Status:** Accepted · **Date:** 2026-09-10 (during Phase 1)

## Context

The masterplan called for snake_case naming throughout. Prisma maps model names
to tables with `@@map` and field names to columns with `@map`. Mapping the
tables is 48 directives. Mapping the columns would be roughly 700.

## Decision

Table names are snake_case via `@@map` (`booking_inquiries`,
`event_lineup_slots`, `media_assets`). **Column names keep Prisma's default
camelCase** (`startsAt`, `deletedAt`, `isPast`). Raw SQL quotes them:
`"startsAt"`.

## Consequences

- Roughly 700 fewer directives to write, review and keep correct. Each one
  would have been a place for a typo to hide, and a typo in a `@map` is a
  silent column mismatch rather than a loud error.
- Model code and SQL read the same way, which materially helps when debugging a
  raw query against the equivalent Prisma call.
- Raw SQL must quote every column identifier, because Postgres folds unquoted
  identifiers to lowercase. `prisma/sql/post-migrate.sql` does this throughout,
  and the integration tests in `schema.int-spec.ts` would fail loudly if it did
  not.
- Cost: a mixed convention — snake_case tables, camelCase columns — which looks
  inconsistent to a DBA reading the database directly. Accepted knowingly:
  consistency of the _mapping layer_ is worth more than consistency of naming
  style, and nobody hand-writes queries against this database.

## Alternatives rejected

- **`@map` on all ~700 fields.** The maintenance burden and drift surface are
  not worth a cosmetic gain.
- **camelCase table names too.** Table names appear in migration files, index
  names and Postgres error messages, where snake_case is markedly more
  readable.
