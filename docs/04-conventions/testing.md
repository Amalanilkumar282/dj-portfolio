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

## API e2e

```bash
cd apps/api
pnpm test         # unit only. No infrastructure needed.
pnpm test:e2e     # boots the app. Needs Postgres, migrations and seeds.
```

Two configs on purpose, so `pnpm test` stays fast and runnable anywhere.

`vitest.e2e.config.ts` requires two things that are **not** optional:

- **`unplugin-swc`.** Vitest transforms with esbuild, which does not support
  `emitDecoratorMetadata`. Without it every constructor-injected dependency
  resolves as `undefined`.
- **`setupFiles: ['./test/setup-env.ts']`.** The specs import `AppModule`
  directly and never load `main.ts`, so the env-precedence fix
  ([ADR 0017](../01-decisions/0017-app-env-precedence.md)) would otherwise be
  absent — and the suite fails claiming it cannot reach `localhost:5432` while
  `.env.local` says something else entirely.

`test/harness.ts` owns the bootstrap. **It must mirror `main.ts`** — global
prefix, URI versioning, `cookie-parser`, `trust proxy` — or the suite tests
routes that do not exist in production, and passes.

### e2e tests must be non-destructive

**The seeded content is the artist's real copy**, harvested from the legacy
site. A spec may read it and may mutate it; it may not leave it changed.

This rule is here because it was broken three ways in one session, and the
failures were maximally confusing:

- A permission test **assumed** a role lacked `persona:delete` and probed the
  delete endpoint to prove it. The assumption was wrong, the request
  succeeded, and it soft-deleted a persona — which failed two _unrelated_
  tests further down the file with a 404 that pointed nowhere near the cause.
- A reorder test rewrote seeded `sortIndex` values and never restored them,
  breaking an integration test **in a different package**.
- Write tests left `"edited by the e2e editor"` in the DJ's real tagline,
  which would have gone straight onto the live page once the web app was
  wired up.

So:

1. **Never probe a destructive endpoint to prove a permission is absent.** It
   is only non-destructive while your assumption holds, and if the assumption
   is wrong the test does damage instead of failing. Assert against the
   resolved permission set from `GET /auth/me` instead — that tests the seed's
   intent directly, and cannot mutate anything.
2. **Anything that must mutate restores in a `finally`**, so a mid-test
   failure cannot leave content changed. See `withRestoredTagline` and the
   reorder test in `rbac.e2e-spec.ts`.
3. **Fixtures are hard-deleted, content never is.** Test users are removed
   with `runWithHardDelete` — the soft-delete extension turns `deleteMany`
   into an `UPDATE`, so a plain delete leaves the row and its unique email
   behind, and the _next_ run fails on a unique-constraint violation that
   looks nothing like the cause.
4. **Prove it.** Run the suite twice, then run the `packages/db` integration
   tests. If all 73 still pass, the suite is clean.

### Rate limits and client addresses

Rate limits are per-IP and the throttler's counters are **process-wide**, so a
whole suite sharing the loopback address throttles _itself_: the specs' own
request volume trips the 30-per-10s window and unrelated assertions fail as
429s that look like flakiness.

`harness.ts` hands out a fresh address from the RFC 5737 documentation range
per call. A spec that means to assert a limit **pins one address
deliberately** — see `'throttles repeated login attempts from one address'`.
Do not "fix" a 429 by raising a limit.

### The OpenAPI snapshot is the contract gate

`apps/api/openapi.json` is committed, so a change shows up as a reviewable
diff instead of being discovered by the frontend after deploy.

**Know what it covers.** Routes, path and query parameters, security
requirements and **request** bodies. It does **not** describe response bodies:
controllers return contract types rather than `createZodDto` response classes,
so every response is currently `{ "200": { "description": "" } }`. Response
safety comes from a different direction — `apps/web` shares the Zod contract
and `safeParse`s at the boundary, so a response change fails `pnpm typecheck`
across the monorepo ([ADR 0004](../01-decisions/0004-zod-contracts-over-openapi-codegen.md)).
That is real, but it is not this gate. See gap #10 in
[`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md).

```bash
pnpm --filter @dj/api openapi:update   # then commit the diff WITH the change
```

The document is built by `src/openapi.ts`, the same function `main.ts` serves
at `/api/docs`, so the snapshot cannot drift from the real API. Duplicating
the `DocumentBuilder` would make the gate worse than useless — it would pass
while the API changed.

Note what it does **not** cover: error _bodies_. The 422-with-JSON-Pointers
contract ([ADR 0018](../01-decisions/0018-validation-is-422-with-json-pointers.md))
is guarded only by `validation-errors.spec.ts` and the auth e2e assertions.

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
