# STATUS — live project state

> **This is the file every session reads first and updates last.**
>
> Update it in the same session you do the work. Tick what is genuinely done
> and verified. If you left something incomplete, say so and say why — an
> honest "blocked" line is far more useful to the next session than an
> optimistic tick.

**Last updated:** 2026-09-10
**Current phase:** Phase 2 — API skeleton & global concerns (not started)
**Phases complete:** 0, 1

---

## Where things stand

The monorepo is scaffolded and the **data layer is complete**: migrated,
seeded and tested against a real Postgres. All three apps build and the API
boots, but they are **scaffolds only** — no business logic, no routes beyond a
health endpoint, no pages beyond a placeholder.

**The next task is Phase 2.** Read
[`../02-architecture/backend.md`](../02-architecture/backend.md) first.

### Verified in this session

Everything below was actually run, not assumed.

| Check                                          | Result                                        |
| ---------------------------------------------- | --------------------------------------------- |
| `pnpm install`                                 | clean, exit 0                                 |
| `pnpm check:env`                               | OK — 30 API variables validated, parity holds |
| `pnpm format:check`                            | clean                                         |
| `pnpm turbo lint typecheck test build`         | **23/23 tasks pass**                          |
| `prisma migrate deploy` from an empty database | 1 migration applies                           |
| `pnpm --filter @dj/db post-migrate`            | applies, and is idempotent on re-run          |
| `pnpm db:seed` (all four layers)               | produces the counts in the table below        |
| `pnpm db:migrate:check`                        | **"No difference detected"** — zero drift     |
| `packages/db` integration tests                | **73 pass**                                   |
| `packages/utils` unit tests                    | **45 pass**                                   |
| API boot + `GET /health`, `/health/ready`      | both return 200                               |
| API boot with a deliberately invalid secret    | refuses to start with a readable error        |
| `apps/web` / `apps/admin` build                | prerender statically, 102KB first-load JS     |
| Internal documentation links                   | all resolve                                   |

### Known gaps and follow-ups

| #   | Item                                                                                                                                                                                         | Why it matters                                                                                                                                                                                                                                                                                                        | Owner |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **No Postgres on this machine.** Neither Docker nor a local Postgres is installed. Phase 1 was verified against a throwaway embedded Postgres 18.4 in the session scratchpad, on port 55432. | Before Phase 2, install Docker Desktop and run `docker compose up -d`, **or** put a Neon connection string in `packages/db/.env`. `docker-compose.yml` is written and correct but **has never been executed here**.                                                                                                   | user  |
| 2   | **No real credentials.** Neon, Cloudinary, Resend and Turnstile values are placeholders in the `.env.example` files.                                                                         | Phase 5 (media) and Phase 6 (email) cannot be verified without them.                                                                                                                                                                                                                                                  | user  |
| 3   | **Legacy Resend API key was committed** in the old `djfelicitous/.env.local`, and looked live.                                                                                               | **Revoke it in the Resend console.** The directory is deleted, but the key may still be valid and may exist in a backup of that folder. [Runbook](../05-operations/runbooks/secret-rotation.md).                                                                                                                      | user  |
| 4   | **The 33 legacy images are no longer on disk.** `djfelicitous/` was deleted before they were uploaded to Cloudinary.                                                                         | They are catalogued in [`../07-content/legacy-audit.md`](../07-content/legacy-audit.md), but the files themselves must come from the artist's originals. Phase 5 (`seed/media.ts`) needs them. Seeded content is text-complete and image-free, which is the correct state for testing the API and fallback rendering. | user  |
| 5   | No events seeded from legacy data                                                                                                                                                            | The legacy gig list carried no dates. Inventing them would repeat the fabricated-testimonial mistake. Real events go in through admin; `seed:demo` covers local dev with `[DEMO]`-prefixed rows.                                                                                                                      | —     |
| 6   | `packages/{motion,media,seo,analytics}` do not exist yet                                                                                                                                     | They were going to be empty stubs, which is worse than absent. Each is created in the phase that needs it: `motion` in 10, `media` and `seo` in 7–9, `analytics` in 8.                                                                                                                                                | —     |

---

## Phase 0 — Foundations ✅

- [x] Legacy data harvested into `packages/db/seed/data/` **before** deletion
- [x] `djfelicitous/` deleted (by the user)
- [x] pnpm workspace + Turborepo pipeline, with an explicit install-script
      allowlist as a supply-chain control
- [x] `@dj/config-ts` — base / node-lib / react-lib / next / nest presets
- [x] `@dj/config-eslint` — flat presets + **4 custom architectural rules**
- [x] `@dj/config-tailwind` — PostCSS for Tailwind v4
- [x] `@dj/utils` — slug, money (INR), date (IST), duration, text, guards +
      **45 unit tests**
- [x] `@dj/contracts` — shared Zod primitives + the cache-tag taxonomy
- [x] `@dj/ui` — `theme.css`, the design-token source of truth, + `cn()`
- [x] `apps/api` — Nest scaffold: Zod-validated config, health endpoints
- [x] `apps/web` — Next 15 scaffold with the legacy 301 redirect map
- [x] `apps/admin` — Next 15 scaffold, `noindex` + `X-Frame-Options: DENY`
- [x] Prettier, EditorConfig, `.gitignore`
- [x] `docker-compose.yml` (postgres 16, mailpit, redis behind a profile)
- [x] `.env.example` for every package that needs one
- [x] `pnpm check:env` — parity, plus a check that no `NEXT_PUBLIC_*` variable
      looks like a secret
- [x] GitHub Actions CI: verify / database / audit / secret-scan jobs
- [x] `docs/` — 50 documents, 15 ADRs
- [x] `CLAUDE.md`
- [ ] `docker compose up -d` verified — **blocked, gap #1**

**Exit criteria met** except the Docker check, which is blocked on the machine
rather than on the code.

## Phase 1 — Data layer ✅

- [x] **48 models, 21 enums** covering every content domain in scope
- [x] Soft delete via a Prisma client extension — `delete` never issues a real
      `DELETE`, and a soft-deleted row is invisible to `findUnique` by id
      **and by slug**
- [x] Audit stamping (`createdBy` / `updatedBy`) from AsyncLocalStorage
- [x] `publishedWhere()` publish-state helper
- [x] Initial migration (1760 lines) applies from empty, including `pg_trgm`
      and 6 GIN trigram indexes declared in the datamodel
- [x] `prisma/sql/post-migrate.sql` — 14 partial indexes, the generated
      tsvector column + GIN index, 12 CHECK constraints. Idempotent and
      transactional.
- [x] Four seed layers with environment guards
- [x] **73 integration tests**
- [x] **Zero migration drift**

### What the seeds produce

|                           | Count                                             | Layer                                   |
| ------------------------- | ------------------------------------------------- | --------------------------------------- |
| Permissions               | 104                                               | system                                  |
| Roles                     | 3 (SUPER_ADMIN 104 / EDITOR 91 / VIEWER 28 perms) | system                                  |
| Genres                    | 22                                                | system                                  |
| Personas                  | 4                                                 | system shell, content fills in          |
| Redirects                 | 15                                                | system                                  |
| Venues                    | 7                                                 | content                                 |
| Programs (branded nights) | 6                                                 | content                                 |
| Tracks                    | 19, real SoundCloud ids                           | content                                 |
| Playlists                 | 4                                                 | content                                 |
| Testimonials              | 8, all `isVerified: false`                        | content                                 |
| Services                  | 6, prices null = "On request"                     | content                                 |
| FAQs                      | 10                                                | content                                 |
| Gear items                | 11 (7 on the rider)                               | content                                 |
| Events                    | 60 (2023–2027)                                    | **demo — synthetic, `[DEMO]` prefixed** |
| Booking inquiries         | 40 across the pipeline                            | **demo — synthetic**                    |
| Page views                | 500                                               | **demo — synthetic**                    |

The legacy `discography.ts` actually held **19** tracks, not the 20 an early
audit reported.

---

## Decisions made during implementation

Recorded because they changed the plan, and a future session would otherwise
wonder why the code does not match the masterplan. Both have full ADRs.

1. **[ADR 0014](../01-decisions/0014-camelcase-columns.md) — column names stay
   Prisma-default camelCase**; only table names are snake_case. The masterplan
   implied snake_case columns, which would have meant `@map` on roughly 700
   fields — a large permanent drift surface for a cosmetic gain. Raw SQL quotes
   camelCase identifiers instead.

2. **[ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md) —
   non-expressible DDL moved out of `prisma/migrations`** into
   `prisma/sql/post-migrate.sql`. While partial indexes, CHECK constraints and
   the generated column lived inside a migration, `prisma migrate diff`
   reported all of them as pending removals and the `migrate:check` CI gate
   could never pass. Splitting them out makes the gate exact. The 6 trigram
   indexes moved the other way — into the datamodel — because Prisma _can_
   express them.

## Bugs found and fixed while building

Worth reading before touching the same code.

1. **`runWithDbContext` silently dropped audit attribution.** It returned the
   callback's promise out of the `AsyncLocalStorage` scope. Prisma's
   `PrismaPromise` is lazy and does not execute until awaited, so the query ran
   _after_ the scope had exited and `createdBy` came back `null` with no error
   anywhere. It now awaits inside the scope.
   Regression test: `soft-delete.int-spec.ts` →
   `'survives a lazily-returned PrismaPromise'`. **Do not "simplify" that
   function.**

2. **The ESLint config silently discarded `disableTypeChecked`.** The config
   block spread `...tseslint.configs.disableTypeChecked` and then declared
   `rules:` after it, overwriting the entire rules object from the spread.
   Type-aware rules then ran on files outside the tsconfig project and crashed.
   Now merged explicitly.

3. **`nest build` produced an empty `dist/`.** `incremental: true` plus
   `deleteOutDir: true` meant tsc read a stale `tsbuildinfo`, concluded the
   output was current, and emitted nothing — a container that cannot start,
   with a zero exit code. `incremental` is now off in the Nest preset.

4. **`formatINR` compact mode overstated prices.** `maximumFractionDigits: 0`
   applied to compact notation too, so ₹2,50,000 rendered as "₹3L" instead of
   "₹2.5L". Now allows one fraction digit.

5. **`app.get('ConfigService')` threw at boot.** Nest resolves providers by
   class reference, not string token.

6. **Turbo strict env mode hid `DATABASE_URL` from the test task**, so the
   integration tests fell back to `localhost:5432` and spent five minutes
   timing out. The env contract is now declared in `turbo.json`.

7. **`typecheck` raced the app's own `build`.** Next generates `.next/types`
   during build and the app tsconfig requires them, so `typecheck` now depends
   on `build`.

---

## Phase 2 — API skeleton & global concerns ⬜ NOT STARTED

**Start here.** Read [`../02-architecture/backend.md`](../02-architecture/backend.md).

Already in place: `apps/api` boots, `ConfigModule` validates 30 variables with
Zod and refuses to start on invalid config, and `/health` + `/health/ready`
respond.

- [ ] Pino logging + request-id correlation + redaction
- [ ] `/api/v1` URI versioning, global prefix, `/health` excluded
- [ ] Global guards **in order**: Throttler → JwtAccess → Permissions
- [ ] Global filters: Sentry → Prisma → AllExceptions (RFC 9457
      `application/problem+json`)
- [ ] Global interceptors: RequestContext → Timeout → Idempotency → HttpCache
      → Audit → ClassSerializer
- [ ] `PrismaModule` wrapping `createPrismaClient()` from `@dj/db`
- [ ] Terminus health indicators replacing the placeholder controller
- [ ] Swagger at `/api/docs` (`SWAGGER_ENABLED` already refuses `true` in
      production)
- [ ] helmet, CORS with credentials, compression, 256kb body limit,
      `trust proxy`
- [ ] Graceful shutdown

**Exit criteria:** `/health/ready` returns 200 with database and Cloudinary
checks; `/api/docs` renders; a deliberately thrown error returns valid
`application/problem+json` carrying a `requestId` that appears in the logs; a
30-second handler is cut off at 15 seconds by the timeout interceptor.

---

## Phases 3–13 ⬜ NOT STARTED

See [`phases.md`](phases.md) for the full table with exit criteria.

| Phase |                                | Depends on                |
| ----- | ------------------------------ | ------------------------- |
| 3     | Auth & RBAC                    | 2                         |
| 4     | Core content CRUD              | 3                         |
| 5     | Media pipeline                 | 4, Cloudinary credentials |
| 6     | Remaining content + engagement | 4, Resend credentials     |
| 7     | Web shell + data + SEO core    | 4                         |
| 8     | Conversion (booking funnel)    | 6, 7                      |
| 9     | Media & player                 | 5, 7                      |
| 10    | Cinematic + signature motion   | 9                         |
| 11    | Admin panel                    | 3, 4, 5, 6                |
| 12    | Hardening & launch             | all                       |
| 13    | Growth                         | 12                        |
