# Testing

## What belongs where

| Layer       | Tool                                   | Scope                                                                                                                                                        |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | Vitest                                 | Pure logic: mappers, slug/cursor/permission helpers, Zod schemas, `cva` variants, JSON-LD builders, date and money formatting, the **token contrast matrix** |
| Integration | Vitest + real Postgres                 | Repositories, the soft-delete and audit extensions, transactions, constraint violations, the post-migrate DDL                                                |
| API e2e     | Vitest + supertest on a booted app     | Auth matrix, RBAC matrix, publish workflow, pagination, problem-details shape, idempotency replay                                                            |
| Contract    | Zod round-trip + OpenAPI snapshot diff | Catches breaking API changes before the frontend does                                                                                                        |
| Web unit    | Vitest + RTL + MSW                     | Query modules, server actions, components                                                                                                                    |
| Web e2e     | Playwright                             | Critical journeys, no-JS, link crawl                                                                                                                         |
| A11y        | `@axe-core/playwright`, `vitest-axe`   | Every route, every component                                                                                                                                 |
| Visual      | Playwright `toHaveScreenshot`          | 3 viewports × 4 persona themes                                                                                                                               |
| Perf        | Lighthouse CI, `size-limit`            | Budget gates                                                                                                                                                 |

## Coverage gates

| Area                                   | Minimum  |
| -------------------------------------- | -------- |
| `apps/api/src/modules/auth/**`         | **100%** |
| `apps/api/src/common/guards/**`        | 100%     |
| `packages/*`                           | 85%      |
| `apps/api/src/modules/**/*.service.ts` | 85%      |
| `apps/web/src/{lib,server,components}` | 70%      |

Auth is at 100% because we hand-rolled it
([ADR 0003](../01-decisions/0003-nestjs-hand-rolled-auth.md)). Anything less
there is theatre.

Coverage is a floor, not a goal. A 100%-covered function with no assertion
about its behaviour is worth nothing.

---

## Integration tests need a database

`packages/db` tests run against real Postgres. They do **not** mock Prisma —
mocking Prisma would test the mock, and the whole point is verifying that
`delete` really does issue an `UPDATE` and that the CHECK constraints really do
reject bad rows.

**In CI:** Testcontainers (`postgres:16-alpine`). Chosen over a Neon branch per
run: no network flakiness, no branch-quota contention, parallel-safe, free.
Neon branches are used for **preview environments** instead, where testing
against a real pooler is the point.

**Locally:** `docker compose up -d`, or any reachable Postgres via
`packages/db/.env`.

```bash
cd packages/db
pnpm test
```

`vitest.config.ts` sets `fileParallelism: false` — the integration specs share
one database and must not race.

### Two tests that exist for specific reasons

**`schema.int-spec.ts`** asserts that every partial index and CHECK constraint
in `prisma/sql/post-migrate.sql` actually exists. Prisma cannot see those
objects, so without these assertions a run that silently skipped the
post-migrate step would leave the database slow and permissive with nothing to
show for it. The partial-index test also asserts the `WHERE` predicate is
present, because an index of the right name without its predicate would index
the whole table.

**`soft-delete.int-spec.ts` → `'survives a lazily-returned PrismaPromise'`** is
a regression guard for a real bug: Prisma's `PrismaPromise` is lazy, so
returning it out of an `AsyncLocalStorage` scope meant the query ran with no
context and audit stamping silently produced `null`. Do not delete this test,
and do not "simplify" `runWithDbContext`.

---

## Web e2e — the journeys that must be covered

- Home → persona switch → full booking wizard submit against a seeded API
- Audio playback **persists across five navigations** (proves the mini player
  is above the route slot)
- Gallery lightbox via the intercepting route **and** via a hard-nav deep link
- Back-button correctness through the lightbox
- Admin: login → create track → schedule → preview → publish → **appears on
  the public route**. This tests the whole `revalidateTag` loop end to end and
  is the most valuable single test in the suite.
- **`javaScriptEnabled: false` run** — every page renders and every form still
  submits
- **Link crawl asserting 200 on every internal href.** This permanently closes
  the legacy dead-footer-link class of bug: eight footer links pointed at
  routes that never existed.

## Determinism

- `seed:demo` uses `faker.seed(20260910)`, so screenshots and assertions are
  stable across runs.
- Visual regression forces `animations: 'disabled'`,
  `prefers-reduced-motion: reduce`, and preloads fonts.
- Never assert on `new Date()`. The `no-restricted-syntax` rule flags bare
  `new Date()` for this reason — pass an explicit timestamp or use a clock
  abstraction.

## Writing a good test here

**Do** assert behaviour a user or caller can observe. `findUnique` on a
soft-deleted row returns null. A published track appears in the public list. A
409 carries the referencing entities.

**Do not** assert implementation detail — that a service called a repository
method with particular arguments. That test breaks on every refactor and
catches no bugs.

**Name the test after the guarantee**, not the function:
`'hides soft-deleted rows from findUnique by slug'` beats
`'findUnique works'`. The slug case is named explicitly because it is the one
that matters — it is how every public page resolves content.
