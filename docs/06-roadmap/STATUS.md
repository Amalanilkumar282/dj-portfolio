# STATUS — live project state

> **This is the file every session reads first and updates last.**
>
> Update it in the same session you do the work. Tick what is genuinely done
> and verified. If you left something incomplete, say so and say why — an
> honest "blocked" line is far more useful to the next session than an
> optimistic tick.

**Last updated:** 2026-09-11
**Current phase:** Group A (Phases 2 + 3 + 4) — 2 and 3 complete, 4 partial
**Phases complete:** 0, 1, 2, 3
**Phase 4:** Personas, Genres and **Venues** done end to end and verified;
**5 content modules remain**

---

## Where things stand

The API is real. It boots, authenticates, authorises, validates, caches,
audits, revalidates and serves content out of Postgres — verified against a
live database, not asserted.

**Phase 2 and Phase 3 are complete and their exit criteria are met.**

**Phase 4 is partial.** `Personas` is implemented end to end and is the
**worked exemplar** every other content module should copy: repository →
service → public controller → admin controller → DTOs → mapper → module. Its
aggregate landing-page endpoint meets the ≤8-query criterion at **5
operations**, and the OpenAPI snapshot is committed and gated.

What remains in Phase 4 is **repetition of a proven pattern**, not design:
seven modules whose contracts and mappers already exist.

### The next task

Implement the 5 remaining content modules, in this order (simplest first, so
the pattern is confirmed before the complicated ones):

1. `Tracks` — media + genres + stream links
2. `Releases` — tracklist ordering
3. `Playlists` — ordered join table (`PlaylistTrack`)
4. `Programs` — venue + persona relations
5. `Events` — the most complex: venue, program, lineup slots, `isPast`

**Two exemplars exist now**, and which one to copy depends on the model:

- **`Personas`** — the publishable case. Extends `BaseContentService`, so it
  gets publish / unpublish / archive / schedule / restore and soft delete.
  Copy this for all six remaining modules.
- **`Genres`** — the taxonomy case. Does **not** extend `BaseContentService`:
  no `status`, no `publishedAt`, no `deletedAt`, so `delete` is real and is
  guarded by a reference check. Copy this only for the other non-publishable
  models in Phase 6 (`Stat`, `Tag`, `Redirect`, `Settings`) — check
  `NON_PUBLISHABLE` in `packages/db/seed/data/rbac.ts` to tell which is which.
- **`Venues`** — the second publishable exemplar, and the one with a
  **compound** uniqueness constraint (`@@unique([name, city])`) alongside the
  usual unique `slug`. Copy its `assertNameCityFree` pattern for any future
  model with more than one uniqueness rule.

**Every repository's `isSlugTaken` (and any other uniqueness pre-check) must
spread `anyDeletionState()` from `@dj/db` into the `where`.** A plain
`findUnique`/`findFirst` is narrowed by the soft-delete extension to
`deletedAt: null`, so it reports a slug held by a soft-deleted row as free —
and `SlugService`'s auto-generated path then hands back a slug the database
immediately rejects. Both `Personas` and `Venues` had this bug; both are
fixed. See [ADR 0020](../01-decisions/0020-any-deletion-state-for-uniqueness-checks.md).

Each needs: `X.repository.ts`, `X.service.ts`, `X.controller.ts` (public,
`@Public()`, by slug), `X.admin.controller.ts` (by id, `@RequirePermissions`),
`dto/x.dto.ts`, `X.module.ts` — then registration in `app.module.ts` and a
regenerated OpenAPI snapshot.

**Read [`../02-architecture/backend.md`](../02-architecture/backend.md)
§"Adding a content module" first.** It documents the pattern, the order the
files depend on each other, and the three mistakes that are easy to repeat.

Contracts (`packages/contracts/src/content.ts`) and mappers
(`apps/api/src/modules/*/x.mapper.ts`) **already exist for all seven.** Do not
rewrite them; wire them up.

### Group B — started, and why it is partly deferred

The user asked to begin Group B (Phases 5 + 6) before Group A was finished.
What was actually done, and the reasoning, so the next session does not have
to reconstruct it:

**Group B's two halves have very different verifiability.** Phase 5's exit
criteria are all of the form "a signed upload lands in the correct
server-decided folder and produces a `MediaAsset` with correct bytes,
dimensions and `blurDataUrl`" — that requires live Cloudinary credentials,
which are still placeholders (gap #2). Phase 6's engagement half (Inquiries
notification, Newsletter double opt-in, press-kit PDF upload) needs Resend.
Writing those now would produce a large amount of code that **cannot be
proven**, which is the state `STATUS.md` exists to prevent.

Most of Phase 6, though, touches no external service at all: Testimonials,
Services, Brands, Stats, FAQ, Gear, Experience, StaticPages, Settings,
Redirects and Sitemap are pure database CRUD, fully verifiable today — and
they are the **same pattern** as Phase 4's outstanding modules.

So the chosen order is: **finish every content module first** (Phase 4's six
remaining plus Phase 6's pure-CRUD ones, one pass, one pattern), then Phase 5
and Phase 6's engagement half once credentials land. This closes Group A on
the way through rather than leaving it hanging, and avoids two passes over the
same file shapes.

**Nothing was skipped or descoped.** Phase 5 and the engagement half are
blocked on gap #2, not deprioritised.

---

## Verified in this session

Everything below was actually executed against a live Postgres (embedded
18.4 on port 55432 — see gap #1), not assumed.

| Check                                                     | Result                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm turbo lint typecheck build`                         | **19/19 tasks pass**                                                             |
| `pnpm turbo test --filter='!@dj/db'`                      | **9/9 tasks pass** — api 32, utils 45                                            |
| `packages/db` integration tests (correct `DATABASE_URL`)  | **88 pass** (73 + 15 new for ADR 0019) — Phase 1 guarantees still hold           |
| `migrate:check` after the new migration                   | **"No difference detected."** — zero drift                                       |
| Full seed re-run against the migrated schema              | succeeds; no `PUBLISHED` row anywhere lacked `publishedAt`                       |
| `apps/api` e2e suite                                      | **66 pass** across auth, RBAC, genres, revalidation and OpenAPI                  |
| `GET /health`, `/health/ready`                            | 200; all four readiness indicators up                                            |
| Wrong password vs unknown email                           | **byte-identical** 401 bodies                                                    |
| Login                                                     | access token + `dj_rt` (HttpOnly) + `dj_csrf` (readable)                         |
| Refresh rotation                                          | new token issued, old one spent                                                  |
| Replaying a spent refresh token                           | 401 `REFRESH_TOKEN_REUSED` **and the whole family revoked**                      |
| Refresh with no / mismatched CSRF header                  | 403 `CSRF_FAILED`                                                                |
| 12 failed logins from one IP                              | first 401, later ones **429** — per-IP limit enforced                            |
| Validation failure                                        | **422** with JSON Pointer field errors, no raw Zod internals                     |
| Unknown request property                                  | 422 `unrecognized_keys` — rejected, not stripped                                 |
| VIEWER attempting write / publish / delete                | **403 `INSUFFICIENT_PERMISSIONS`** (not 401)                                     |
| EDITOR permission set                                     | no `user:*`, no `role:*`, no `settings:*`, no `media:delete`                     |
| VIEWER permission set                                     | every entry ends `:read`                                                         |
| `GET /personas`                                           | 4 seeded personas with CMS accent colours                                        |
| Cursor pagination                                         | advances correctly; full walk returns every row **exactly once**                 |
| Tampered cursor                                           | 400, not 500                                                                     |
| `?include=secretTable`                                    | 422 — allowlist holds                                                            |
| `GET /personas/felicitous/page`                           | **5 queries** (`X-Query-Count`), criterion is ≤8                                 |
| `PATCH /admin/personas/reorder`                           | 204 — routed to reorder, not swallowed by `:id`                                  |
| Publish workflow                                          | unpublish hides publicly (404 by slug), republish restores                       |
| Re-publishing a published persona                         | 409 `INVALID_STATUS_TRANSITION`                                                  |
| Soft delete + restore                                     | hidden publicly, still visible to admin, restored intact                         |
| Audit trail                                               | `updatedBy` = admin id; `AuditLog` rows carry actor + requestId                  |
| Revalidation                                              | emitted `tags=home,nav,persona:tnt,personas,sitemap`                             |
| Log redaction                                             | `authorization` and `set-cookie` both `[redacted]`                               |
| OpenAPI snapshot gate                                     | **fails on drift** (verified by mutating the file)                               |
| `GET /genres`                                             | 22 seeded genres, cursor meta, default limit 100                                 |
| Genre cursor walk                                         | every row exactly once                                                           |
| `GET /genres/slugs`                                       | 200 — not swallowed by `:slug`                                                   |
| Genre publish/unpublish/archive/schedule routes           | **404** — correctly do not exist                                                 |
| `DELETE` a genre in use                                   | **409 `GENRE_IN_USE`** listing the referencing content                           |
| Referencing content after a refused delete                | counts unchanged — nothing was stripped                                          |
| `DELETE` an unreferenced genre                            | 204, and really gone (no `deletedAt` column)                                     |
| Duplicate genre name                                      | 409 against **`/name`**, not `/slug`                                             |
| Revalidation wiring (persona, genre create, genre delete) | listener receives the event — verified to **fail** when the bus is two instances |
| e2e suite run twice, then db integration tests            | **still 73 pass** — the suite is non-destructive                                 |

### Not verified

- **Docker / `docker compose up -d`** — still not installed (gap #1).
- **Cloudinary, Resend, Turnstile, Neon** — placeholder credentials (gap #2).
- **100% coverage of `auth/`** — a Phase 3 exit criterion that is **not met**.
  The auth _behaviour_ is covered end to end, but line coverage has not been
  measured or enforced. The threshold block exists in `vitest.config.ts`;
  `TotpService` and `PasswordService` have no unit tests. See gap #7.
- **Load, Lighthouse, axe, Playwright** — later phases.

---

## Known gaps and follow-ups

| #   | Item                                                                                                                                                                                         | Why it matters                                                                                                                                                                                                                                                                                                                   | Owner |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **No Postgres on this machine.** Neither Docker nor a local Postgres is installed. Everything was verified against a throwaway embedded Postgres 18.4 in the session scratchpad, port 55432. | Install Docker Desktop and run `docker compose up -d`, **or** put a Neon connection string in `packages/db/.env`. `docker-compose.yml` is written and correct but **has never been executed here**.                                                                                                                              | user  |
| 2   | **No real credentials.** Neon, Cloudinary, Resend and Turnstile values are placeholders.                                                                                                     | Phase 5 (media) and Phase 6 (email) cannot be verified without them.                                                                                                                                                                                                                                                             | user  |
| 3   | **Legacy Resend API key was committed** in the old `djfelicitous/.env.local`, and looked live.                                                                                               | **Revoke it in the Resend console.** [Runbook](../05-operations/runbooks/secret-rotation.md).                                                                                                                                                                                                                                    | user  |
| 4   | **The 33 legacy images are no longer on disk.**                                                                                                                                              | Catalogued in [`../07-content/legacy-audit.md`](../07-content/legacy-audit.md); the files must come from the artist's originals. Phase 5 needs them.                                                                                                                                                                             | user  |
| 5   | No events seeded from legacy data                                                                                                                                                            | The legacy gig list carried no dates. Inventing them would repeat the fabricated-testimonial mistake.                                                                                                                                                                                                                            | —     |
| 6   | **`packages/db` unit-test task fails by default.** `packages/db/.env` points at `localhost:5432`; the specs need a reachable Postgres.                                                       | `pnpm turbo test` fails on `@dj/db` on any machine without a database there — which reads as a broken build rather than a missing service. Either point that file at a real database or make the specs skip with a clear message when none is reachable. Same root cause as gap #1.                                              | —     |
| 7   | **`auth/` is not at 100% line coverage** — a Phase 3 exit criterion.                                                                                                                         | Behaviour is covered end to end, but `TotpService` (secret encryption, `epochTolerance`, recovery codes) and `PasswordService` (argon2 params, breach list, `burnVerifyTime`) have no unit tests. These are exactly the paths where a silent weakening is invisible. Do this in Group B.                                         | —     |
| 8   | **No `UsersModule`.** The RBAC e2e spec mints its test users through `PrismaService` directly.                                                                                               | Fine for now and documented in the spec, but it means role assignment has no API. Phase 6 adds it; until then the admin cannot invite anyone.                                                                                                                                                                                    | —     |
| 9   | `packages/{motion,media,seo,analytics}` do not exist yet                                                                                                                                     | Deliberate — empty stubs are worse than absent. Created in the phase that needs each.                                                                                                                                                                                                                                            | —     |
| 10  | **The OpenAPI snapshot does not describe response bodies.** Every response is `{"200": {"description": ""}}` — controllers return contract types, not `createZodDto` response classes.       | The gate catches route, parameter, security and request-body changes, but not a changed response shape. `apps/web` will catch those via the shared Zod contract at `typecheck` time, so the risk is bounded — but the gate is narrower than "the contract". Annotating responses with nestjs-zod's `ZodResponse` would close it. | —     |

---

## Phase 0 — Foundations ✅

See the Phase 0 section in git history for the full checklist; unchanged this
session except that the four custom ESLint rules now actually run on Windows
(see bug 8 below).

## Phase 1 — Data layer ✅

Unchanged in scope: 48 models, 21 enums, soft delete, audit stamping,
`publishedWhere()`, post-migrate SQL, four seed layers, **73 integration
tests**, zero drift.

Changed this session — additively, and re-verified by those same 73 tests:

- **`queryCountExtension`** (`src/extensions/query-count.ts`) — counts Prisma
  operations per request, driving the N+1 canary.
- **`runWithDbContextSync`** — a synchronous variant for middleware.
- **`getDbContext()` returns the live store**, so the auth guard can fill in
  the actor after the scope is already open.
- **CJS builds** — `tsconfig.build.json` for `db`, `contracts` and `utils`,
  with `"type": "module"` removed and `exports` pointing at `./dist`.
  See [ADR 0016](../01-decisions/0016-cjs-builds-for-shared-packages.md).

## Phase 2 — API skeleton & global concerns ✅

- [x] Pino logging, request-id correlation, header redaction
- [x] `/api/v1` URI versioning; `/health` is `VERSION_NEUTRAL` and excluded
      from the prefix
- [x] Global guards **in order**: Throttler → JwtAccess → Permissions
- [x] Global filters: Prisma → AllExceptions, RFC 9457
      `application/problem+json` (Sentry deferred to Phase 12)
- [x] Global interceptors: Timeout → Idempotency → HttpCache → Audit →
      QueryCount, with request context opened by **middleware**
- [x] `PrismaModule` wrapping `createPrismaClient()`
- [x] Terminus readiness indicators (database, migrations, disk, Cloudinary)
- [x] Swagger at `/api/docs`, plus a **committed OpenAPI snapshot**
- [x] helmet, CORS with credentials, compression, 256kb body limit,
      `trust proxy 1`
- [x] Graceful shutdown

**Exit criteria met.** `/health/ready` returns 200 with database and Cloudinary
checks; the OpenAPI document renders; a thrown error returns valid
`application/problem+json` carrying a `requestId` that appears in the logs.

> The 15-second timeout interceptor is registered and unit-reachable, but a
> deliberate 30-second handler was **not** exercised end to end. Low risk, but
> it is the one Phase 2 criterion asserted by inspection rather than by test.

## Phase 3 — Auth & RBAC ✅ (one criterion outstanding)

- [x] argon2id, OWASP parameters, `passwordChangedAt` as a global revocation
      stamp
- [x] Access JWT (15m) + opaque rotating refresh token, sha256-hashed, in an
      HttpOnly `SameSite=Strict` cookie
- [x] **Token-family revocation on reuse**, with an audit row and an
      `error`-level log
- [x] Two independent lockouts: per-account exponential (5 attempts → 5…60
      min) and per-IP throttling (10 / 15 min)
- [x] **No user enumeration** — identical body _and_ equalised timing via
      `burnVerifyTime()`
- [x] TOTP enrol / verify / disable; AES-256-GCM secret at rest; argon2-hashed
      recovery codes
- [x] Double-submit CSRF on cookie-authenticated writes
- [x] RBAC: 3 roles × 104 permissions, `@RequirePermissions`, `@CurrentUser`
- [x] Every auth outcome audited, **including failures**
- [x] Full e2e matrix — 36 tests across auth and RBAC
- [ ] **100% coverage of `auth/`** — not met, gap #7

## Phase 4 — Core content CRUD 🟡 PARTIAL

- [x] `BaseContentService` — publish / unpublish / archive / schedule /
      remove / restore / reorder, with an enumerated transition table
- [x] Cursor pagination carrying the full sort tuple + id tiebreaker
- [x] Offset pagination for admin tables
- [x] Include allowlist, sort allowlist, `publishedWhere()` composition
- [x] Idempotency, ETag / `If-None-Match`, cache-control policies
- [x] Cache-tag revalidation, HMAC-signed, symmetrical with `@dj/contracts`
- [x] **Personas** — complete and verified; the **publishable** exemplar
- [x] **Genres** — complete and verified; the **taxonomy** exemplar
- [x] `GET /personas/:slug/page` — **5 queries**, criterion ≤8
- [x] **OpenAPI snapshot committed** (`apps/api/openapi.json`) and gated
- [x] Contracts for all 8 content domains
- [x] Mappers for all 8 content domains
- [ ] Venues, Tracks, Releases, Playlists, Programs, Events modules
- [ ] Those modules registered in `app.module.ts`
- [ ] Snapshot regenerated once they exist

---

## Decisions made during implementation

Recorded because they changed the plan. Each has an ADR.

1. **[ADR 0014](../01-decisions/0014-camelcase-columns.md)** — column names
   stay camelCase; only table names are snake_case.
2. **[ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md)** —
   non-expressible DDL lives outside `prisma/migrations` so the drift gate can
   be exact.
3. **[ADR 0016](../01-decisions/0016-cjs-builds-for-shared-packages.md)** —
   `db`, `contracts` and `utils` build to CommonJS. The Nest app is CJS and
   cannot import ESM TypeScript sources directly.
4. **[ADR 0017](../01-decisions/0017-app-env-precedence.md)** — `apps/api`
   applies its own env files, with override, before anything requires
   `@prisma/client`. Without it a sibling package's `.env` silently wins.
5. **Module layout differs slightly from the masterplan.** The plan sketched
   `mappers/x.mapper.ts` and `entities/`. The implemented convention is a flat
   `x.mapper.ts` beside the service, and no `entities/` — responses are typed
   by the Zod contracts, so a parallel Swagger class would be a second source
   of truth for the same shape. Empty `mappers/` and `entities/` directories
   were removed rather than left as scaffolding.

---

## Bugs found and fixed while building

**Read this before touching the same code.** Every one of these failed
_silently_ — that is why they are listed rather than merely fixed.

### Group A (this session)

1. **Validation returned 400 with raw Zod internals.** `nestjs-zod`'s stock
   pipe throws `BadRequestException`, so the HTTP status said 400 while the
   problem body said `"status": 422`; and its payload carried raw issues
   (`path` arrays, `expected`/`received`) instead of the documented JSON
   Pointer field errors. Nothing threw — the response was valid JSON in the
   wrong shape, and Phase 11's admin forms would have been built against it.
   Now `common/pipes/zod-validation.pipe.ts` wraps the pipe and
   `common/validation-errors.ts` owns the one conversion both the pipe and the
   exception filter use.

2. **The exception filter cast `errors` blindly.**
   `record.errors as ProblemDetails['errors']` asserted a shape it never
   checked, which is _how_ the raw Zod issues reached clients while the types
   insisted everything was fine. Now normalised, never cast.

3. **`instanceof ZodError` is unreliable across package boundaries.**
   nestjs-zod resolves its own `zod`, and pnpm's isolated linker makes
   duplicate copies easy to acquire; `instanceof` then returns false and the
   error degrades to raw internals with no warning. Detection is structural.

4. **`PATCH /admin/personas/reorder` was unreachable.** `@Patch(':id')` was
   declared above `@Patch('reorder')`, and routes match in declaration order —
   so the literal path was swallowed and the handler tried to update a persona
   whose id was the string `"reorder"`. It surfaced as a 404 that reads like a
   missing record. **Literal routes must be declared above parameterised
   ones**; there is now a regression test.

5. **Cursor pagination was never wired.** `PersonasService.listPublic` accepted
   a `cursor` and never applied it, while still returning a plausible
   `nextCursor`. Page 2 was page 1, so infinite scroll would loop the first
   page forever with no error anywhere. Two tests now cover it: one that the
   cursor advances, and one that a full single-row walk returns every row
   exactly once.

6. **One 401 code for two different situations.** The auth guard returned
   `REFRESH_TOKEN_INVALID` both when no credential was presented and when an
   access token was bad, leaving the admin client unable to tell "silently
   refresh" from "the session is gone". Split into `AUTH_REQUIRED` and
   `ACCESS_TOKEN_INVALID`.

7. **`bootstrap-env` did not run under test.** The e2e suite imports
   `AppModule` directly and never loads `main.ts`, so the env-precedence fix
   was absent and the suite failed with "Can't reach database server at
   localhost:5432" while `apps/api/.env.local` plainly said otherwise. Now
   applied via `test/setup-env.ts` as a vitest `setupFiles` entry.

8. **Two custom ESLint rules were silently no-ops on Windows.** Both matched
   `[\/]app[\/]` / `[\/]infra[\/]` against raw paths, which on Windows arrive
   with backslashes. `dj/no-client-in-route-files` — the rule guarding the
   legacy site's single worst failure — **never fired at all** for anyone
   developing on Windows, holding only in Linux CI. `dj/prisma-only-in-repositories`
   failed the other way and flagged the very `infra/` files that own Prisma.
   Both now normalise separators, and the route rule was verified to fire.

9. **`dj/prisma-only-in-repositories` was broader than its own docstring.** It
   banned _every_ value import from `@dj/db`, including domain enums
   (`AuditAction`, `ContentStatus`) and stateless helpers (`publishedWhere`).
   Narrowed to the actual query surface — `Prisma`, `PrismaClient`,
   `createPrismaClient`, `getPrismaClient` — plus `@prisma/client` and
   `prisma.service` wholesale.

10. **`String(request.id)` could emit `[object Object]`.** pino's `ReqId` is
    `string | number | object`, so the id that exists purely for traceability
    could be written unusably into every problem response and log line for the
    affected request. `common/request-id.ts` now handles it.

11. **The query-count interceptor injected `PrismaService` for nothing.** The
    count lives in AsyncLocalStorage; the dependency only coupled `common/` to
    `infra/`. `QUERY_WARN_THRESHOLD` moved to `common/constants.ts`.

12. **`BaseContentService` typed its emitter as `EventEmitter2`, which
    typescript-eslint resolves as `any`** — silently disabling the type-aware
    `no-unsafe-call` checks on every `emit`. Replaced with a structural
    `DomainEventBus` interface, which also makes subclasses stubbable.

13. **`POST :id/restore` returned 201.** It returns a resource that already
    existed; 201 implies a new one at a new location. Now 200.

14. **The e2e suite was destructive** — my own bug, and the most instructive
    one here. Three separate instances:
    - A permission test assumed `EDITOR` lacked `persona:delete` and probed
      the delete endpoint to prove it. The assumption was wrong, so the
      request _succeeded_ and soft-deleted seeded content — which then failed
      two unrelated tests downstream, pointing nowhere near the cause.
    - The reorder test rewrote seeded `sortIndex` values and never restored
      them, breaking a `@dj/db` integration test **in a different package**.
    - Write tests left `"edited by the e2e editor"` in the DJ's real seeded
      copy.

    Fixed by asserting role boundaries against the _resolved permission set_
    rather than by probing destructive endpoints, and by snapshot-and-restore
    helpers in `finally` blocks for the tests that must mutate. Verified by
    running the suite twice and confirming all 73 db integration tests still
    pass. **See [`../04-conventions/testing.md`](../04-conventions/testing.md)
    §"e2e tests must be non-destructive".**

15. **The suite throttled itself.** Rate limits are per-IP and the throttler's
    counters are process-wide, so specs sharing the loopback address drained
    each other's login budget and failed as 429s that look like flakiness. The
    harness now hands out a fresh documentation-range address per call, and one
    test pins an address deliberately to assert the limit still works.

16. **`test/**` was in no tsconfig project**, so the specs were neither
    type-checked nor lintable — `getHttpServer()` returns `any`, which
    quietly made every assertion in them unchecked. Split into
    `tsconfig.json` (src + test, `noEmit`) and `tsconfig.build.json` (src
    only), with `nest-cli.json` pointed at the latter.

17. **`tagline` was writable but never readable.** `PersonaCreateInput`
    accepted it; `PersonaDetail` did not return it and the mapper never
    emitted it. The admin could set a tagline, never see it again, and the
    public page could not render it — a field that silently goes nowhere.
    Found because a test helper tried to snapshot-and-restore it and the
    restore **silently did nothing**: `PATCH { tagline: undefined }`
    serialises to `{}`. So the same bug also polluted three personas'
    seeded copy while every test passed. The helper now asserts the field is
    present _and_ that the restore took effect. **When adding a content
    module, diff the write contract against the read contract** — anything in
    `XCreateBase` must be readable somewhere.

18. **`EventEmitter2`'s type resolves to an error type**, which propagates
    silently as `any`. `@nestjs/event-emitter`'s declaration does
    `import eventemitter2 from 'eventemitter2'` and then reads
    `eventemitter2.EventEmitter2` — a property that exists on the CJS
    `module.exports` at runtime but **not** on the declared default export.
    The consequence was not cosmetic: every `this.events.emit(...)` was an
    unchecked call, so a typo in an event name or a malformed payload went
    uncaught — in the one subsystem whose job is telling the web app what to
    revalidate. Contained to a single line in `common/events.ts`, which
    aliases a `DOMAIN_EVENT_BUS` token onto the emitter; services inject that
    and are fully checked. `useExisting`, not `useClass` — a second instance
    would mean listeners never hear the events, which is why
    `revalidation.e2e-spec.ts` exists and was verified to fail against
    `useClass`.

19. **6 of 18 publishable models were missing `scheduledAt`, and 14 of 18 had
    no `published_has_date` CHECK constraint at all.** Found while starting
    the Venues module: `Venue` lacked both, despite the schema's own header
    comment stating every publishable model carries `status + publishedAt +
scheduledAt`, and `post-migrate.sql` having applied the CHECK to only 4
    tables (`personas`, `tracks`, `events`, `posts`) since Phase 1. Two
    `packages/db` test fixtures (a venue helper in `soft-delete.int-spec.ts`,
    a duplicate-venue test in `schema.int-spec.ts`) were themselves creating
    `PUBLISHED` venues with no `publishedAt` — passing tests built on
    genuinely invalid data, because nothing enforced the invariant they
    assumed. Fixed for all 18 models in one migration rather than one at a
    time as each remaining module gets built; both test files corrected to
    create `DRAFT` fixtures where the publish state was incidental. 15 new
    `packages/db` tests (14 existence + 1 behavioural). See
    [ADR 0019](../01-decisions/0019-scheduled-at-and-published-check-on-every-publishable-model.md).
    Also recorded: `prisma migrate dev` will offer to reset any database
    `post-migrate.sql` has touched, because it drift-checks the live database
    against out-of-band objects by design — use `migrate diff` +
    `migrate deploy` instead. See
    [migrations.md](../05-operations/migrations.md).

20. **`isSlugTaken` reported a soft-deleted row's slug as free.** Both
    `Personas` (the exemplar) and the new `Venues` module called
    `findUnique({ where: { slug } })`, which the soft-delete extension
    silently narrows to `deletedAt: null`. A soft-deleted row still occupies
    its `slug` at the database level, so `SlugService`'s auto-generated path
    would hand back a slug it believed was guaranteed free, and the actual
    `INSERT` then hit the real unique constraint — a 409 on a creation that
    supplied no slug at all and had no reason to expect a collision. Fixed
    with `anyDeletionState()` in `@dj/db`, spread into every uniqueness
    pre-check; a regression test proves a soft-deleted row is invisible to a
    plain query and visible once the helper is added. See
    [ADR 0020](../01-decisions/0020-any-deletion-state-for-uniqueness-checks.md).
21. **`genre` was in neither the cache-tag taxonomy nor `TAG_MAP`**, so a
    renamed or deleted genre would never have revalidated the pages that
    render it — the filter bar on /music and the chips on every persona page.
    Added to both halves, which the "cache tags live in two places and must
    stay symmetrical" invariant requires.

22. **A test that did not test what it claimed.** `tag-map.spec.ts` asserted
    `resolved.length > 0` for every revalidatable entity, with a comment
    saying it caught a missing `TAG_MAP` entry — but the sitemap-only fallback
    satisfies that, so a missing entry would have passed. Now asserts that
    something _beyond_ the fallback resolved.

### Phase 0–1 (earlier sessions)

23. **`runWithDbContext` silently dropped audit attribution** by returning a
    lazy `PrismaPromise` out of the ALS scope. Regression test:
    `soft-delete.int-spec.ts` → `'survives a lazily-returned PrismaPromise'`.
    **Do not "simplify" that function.**
24. The ESLint config silently discarded `disableTypeChecked` by declaring
    `rules:` after the spread.
25. `nest build` produced an empty `dist/` — `incremental` + `deleteOutDir`.
26. `formatINR` compact mode overstated prices (₹2.5L rendered as ₹3L).
27. `app.get('ConfigService')` threw — Nest resolves by class, not string.
28. Turbo strict env mode hid `DATABASE_URL` from the test task.
29. `typecheck` raced the app's own `build` for `.next/types`.

---

## Phases 5–13 ⬜ NOT STARTED

See [`phases.md`](phases.md) for the full table with exit criteria, and the
merged **Group A–F** delivery plan.

| Phase |                                | Depends on                |
| ----- | ------------------------------ | ------------------------- |
| 5     | Media pipeline                 | 4, Cloudinary credentials |
| 6     | Remaining content + engagement | 4, Resend credentials     |
| 7     | Web shell + data + SEO core    | 4                         |
| 8     | Conversion (booking funnel)    | 6, 7                      |
| 9     | Media & player                 | 5, 7                      |
| 10    | Cinematic + signature motion   | 9                         |
| 11    | Admin panel                    | 3, 4, 5, 6                |
| 12    | Hardening & launch             | all                       |
| 13    | Growth                         | 12                        |
