# 0015 — DDL Prisma cannot express lives outside prisma/migrations

**Status:** Accepted · **Date:** 2026-09-10 (during Phase 1)

## Context

The schema needs three things Prisma's datamodel cannot express: partial
indexes, CHECK constraints, and a GENERATED tsvector column.

The obvious approach is a hand-written migration inside `prisma/migrations`.
That was tried first, and it breaks the CI drift gate.

`prisma migrate diff --from-migrations --to-schema-datamodel` builds a shadow
database from the migrations and diffs it against the datamodel. Anything
present in the migrations but absent from `schema.prisma` is reported as a
pending removal. With 14 partial indexes, 12 CHECK constraints and a generated
column in there, the diff was never empty — so `pnpm db:migrate:check`, whose
entire job is catching "someone edited `schema.prisma` without generating a
migration", could never pass.

## Decision

Split the DDL by ownership:

- **`prisma/migrations/`** — Prisma-generated only, never hand-edited. This is
  what keeps the drift gate exact.
- **`prisma/sql/post-migrate.sql`** — everything Prisma cannot express.
  Idempotent by contract (`IF NOT EXISTS`, `DROP ... IF EXISTS`), applied in a
  single transaction after every `migrate deploy` by `pnpm db:post-migrate`.

Two related moves reduced how much lands in the second bucket:

- The six GIN **trigram indexes** _are_ expressible, via
  `@@index([title(ops: raw("gin_trgm_ops"))], type: Gin)`. They moved into the
  datamodel and are now drift-checked. `pg_trgm` is declared through the
  `postgresqlExtensions` preview feature, so even `CREATE EXTENSION` is
  Prisma-owned.
- `posts.searchVector` is **deliberately absent from `schema.prisma`.** No
  application code reads or writes it — only the raw search query does.
  Declaring it would guarantee permanent drift on the generation expression.

## Consequences

- `pnpm db:migrate:check` reports "No difference detected" and is a usable
  merge gate.
- `db:migrate` and `db:migrate:deploy` both chain `post-migrate`, so the two
  halves cannot drift apart in normal use.
- Applied in one transaction: either every guard lands or none does. A
  half-applied run would leave the database quietly permissive.
- The script uses a plain `pg` client rather than `prisma.$executeRawUnsafe`,
  because Prisma sends raw queries as prepared statements and Postgres rejects
  a multi-statement batch in one: `42601: cannot insert multiple commands into
a prepared statement`. Splitting the file on semicolons would mean
  hand-rolling a SQL lexer that understands string and dollar-quoted literals
  — a worse trade than one dev-only dependency. `pg` is a devDependency and is
  never shipped in the API bundle.
- **`src/__tests__/schema.int-spec.ts` asserts that every index and constraint
  actually exists**, because a run that silently skipped this file would
  otherwise leave the database slow and permissive with nothing to show for it.
  The partial-index test also asserts the predicate is present, since an index
  of the right name without its `WHERE` clause would index the whole table.
- Cost: two commands instead of one, and a file outside Prisma's migration
  history. Mitigated by idempotency, by the chaining, and by the tests.

## Alternatives rejected

- **Hand-written migration inside `prisma/migrations`.** Breaks the drift gate,
  which is the reason this ADR exists.
- **Dropping the drift gate.** It catches a common and expensive mistake;
  keeping it is worth restructuring for.
- **Dropping the partial indexes and CHECK constraints.** The partial indexes
  are the single highest-leverage performance item in the schema, and the
  constraints stop invalid structured data reaching a live page.
