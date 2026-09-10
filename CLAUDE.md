# CLAUDE.md

Guidance for Claude Code and any other agent or developer working in this
repository.

## Read this first

**The architecture is already decided and written down.** Your job is to
implement it, not re-derive it.

Before writing code:

1. **[`docs/06-roadmap/STATUS.md`](docs/06-roadmap/STATUS.md)** — what phase we
   are in and what is actually done. **Always read this.**
2. [`docs/README.md`](docs/README.md) — the documentation map.
3. The [`docs/02-architecture/`](docs/02-architecture/) document covering what
   you are about to change.

Then:

- **Do not deviate from a documented decision.** If one is wrong, write a new
  ADR in [`docs/01-decisions/`](docs/01-decisions/) proposing the change and
  raise it. An undocumented deviation is worse than a documented mistake,
  because the next session cannot tell them apart.
- **Do not skip phases.** See
  [`docs/06-roadmap/phases.md`](docs/06-roadmap/phases.md).
- **Update `STATUS.md` before you finish**, including what you did _not_ do and
  why.
- **Never invent content.** No placeholder testimonials, no venues he has not
  played, no invented gig dates, no guessed prices. The previous site did all
  of these — see [`docs/07-content/brand.md`](docs/07-content/brand.md).

## What this is

A CMS-backed portfolio and booking platform for **DJ Felicitous**, a
Bengaluru-based DJ and producer with four performing identities. It replaces a
static site whose content could only be changed by editing TypeScript files.

The central requirement: **the artist manages 100% of the content himself,
without a developer.**

| App          | Domain                 | What it is                                          |
| ------------ | ---------------------- | --------------------------------------------------- |
| `apps/web`   | djfelicitous.com       | Public site. Server-rendered, cinematic, SEO-first. |
| `apps/admin` | admin.djfelicitous.com | The CMS. **This is the product.**                   |
| `apps/api`   | api.djfelicitous.com   | NestJS. Owns the database and business rules.       |

## Current state (2026-09-10)

Phases 0 and 1 are complete. The monorepo is scaffolded and the data layer is
finished, migrated, seeded and tested against a real Postgres — 48 models,
73 integration tests, zero schema drift.

`apps/api`, `apps/web` and `apps/admin` are **scaffolds only**. Phase 2 is the
next task: the API skeleton and global concerns.
Read [`docs/02-architecture/backend.md`](docs/02-architecture/backend.md).

## Commands

```bash
pnpm install
docker compose up -d              # Postgres (+ --profile mail for Mailpit)

pnpm dev                          # all apps
pnpm --filter @dj/api dev         # :4000
pnpm --filter @dj/web dev         # :3000
pnpm --filter @dj/admin dev       # :3001

pnpm lint                         # includes the 4 custom architectural rules
pnpm typecheck
pnpm test
pnpm check:env                    # .env.example ↔ env.schema.ts parity

pnpm db:generate
pnpm db:migrate                   # migrate + post-migrate SQL
pnpm db:migrate:check             # must report "No difference detected"
pnpm db:seed
pnpm db:studio
```

Full setup: [`docs/05-operations/local-setup.md`](docs/05-operations/local-setup.md).

## The invariants

Enforced by lint rules, database constraints and CI gates — not by good
intentions. **Each one encodes a specific failure of the site being replaced.**
If you are fighting one, you are probably about to reintroduce a bug that has
already been paid for.

| Invariant                                               | Enforced by                          |
| ------------------------------------------------------- | ------------------------------------ |
| No `'use client'` in `page.tsx` / `layout.tsx`          | `dj/no-client-in-route-files`        |
| No raw colour literals in app code                      | `dj/no-raw-color-literals`           |
| Prisma only in `*.repository.ts` and `infra/`           | `dj/prisma-only-in-repositories`     |
| No `$queryRawUnsafe` / `$executeRawUnsafe`              | `dj/no-unsafe-prisma-raw`            |
| Content is never hard-deleted                           | soft-delete Prisma extension         |
| Published content always has a `publishedAt`            | DB `CHECK` constraint                |
| In-page images always have alt text                     | DB `CHECK` constraint                |
| One `site_settings` row, ever                           | DB `CHECK` constraint                |
| Every heavy visual effect has a reduced-motion fallback | `<MotionGate>` + phase exit criteria |
| Every internal link resolves 200                        | Playwright link crawl                |
| `schema.prisma` never drifts from `prisma/migrations`   | `pnpm db:migrate:check`              |

Do not disable a `dj/*` rule. Fix the code.

## Conventions that will trip you up

- **`packages/db/prisma/sql/post-migrate.sql`** holds the DDL Prisma cannot
  express — partial indexes, CHECK constraints, the generated tsvector column.
  It is **not** a Prisma migration, deliberately: keeping
  `prisma/migrations/` purely Prisma-generated is what makes the drift gate
  work. It is idempotent and chained onto `db:migrate`.
  [ADR 0015](docs/01-decisions/0015-post-migrate-sql-outside-migrations.md).
- **Column names are camelCase; only table names are snake_case.** Raw SQL must
  quote them: `"startsAt"`.
  [ADR 0014](docs/01-decisions/0014-camelcase-columns.md).
- **`runWithDbContext` awaits inside its AsyncLocalStorage scope, and must
  keep doing so.** Prisma's `PrismaPromise` is lazy, so returning it out of the
  scope means the query runs with no context and audit stamping silently
  becomes `null`. There is a regression test. Do not "simplify" it.
- **Never `new Date()` bare** — there is a lint rule. Pass an explicit
  timestamp so tests stay deterministic.
- **Always use `@dj/utils` for dates and money.** IST display, UTC storage,
  `en-IN` rupee grouping, and `isoWithIstOffset` for JSON-LD (a bare `Z` makes
  Google show Indian gigs at the wrong time).
- **Cache tags live in two places and must stay symmetrical** —
  `packages/contracts/src/cache-tags.ts` and the API's `TAG_MAP`. An asymmetry
  fails silently as "I published but nothing changed".

## Agent-specific notes

- **Do not commit or `git init`.** The user manages version control here.
- **Do not work around Prisma's guard on `migrate reset`.** It is destructive.
  If a reset is genuinely needed, explain what it destroys and ask.
- Docker is **not installed** on this machine as of 2026-09-10. Phase 1 was
  verified against a throwaway embedded Postgres. See `STATUS.md` gap #1.
- When you finish, say plainly what you verified and how, and what you did
  **not** verify. Put gaps in `STATUS.md`.

## Definition of done

[`docs/04-conventions/definition-of-done.md`](docs/04-conventions/definition-of-done.md)
