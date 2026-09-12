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

## Current state (2026-09-12, Group D session)

Groups A through D (Phases 0-9) are code-complete. Phase 3 has one
documented gap. This session brought in **real Cloudinary, Resend and
Turnstile credentials plus a real Neon Postgres for the first time** —
migrated and seeded fresh, since it had never been touched before. See
below and `STATUS.md`'s Group D section for what "verified" means now
that credentials are real but the media catalogue still has no real
uploads (gap #4/#16).

The data layer is finished, migrated, seeded and tested against a real
Postgres — 48 models, 90 integration tests, zero schema drift. The API boots,
authenticates, authorises, validates, caches, audits and revalidates **25
content/engagement modules**, verified by 163 e2e tests against a live
database.

**Group A — all 8 content modules done and verified**: `Personas`, `Venues`,
`Tracks`, `Releases`, `Playlists`, `Programs`, `Events` (publishable — extend
`BaseContentService`) and `Genres` (taxonomy — no publish workflow, guarded
hard delete).

**Group B — all 17 modules written and wired**: `Media` (signed uploads,
confirm-via-Cloudinary-reread, two-phase delete, orphan sweeper),
`Testimonials`, `Services`, `Brands`, `Stats`, `Faq`, `Gear`, `Experience`,
`StaticPages`, `Settings` (singleton), `Redirects`, `Sitemap`, `Inquiries`
(spam scoring, honeypot, retry cron), `Newsletter` (double opt-in),
`PressAssets` (+ EPK PDF generator), `Tags`, `Posts`. The pure-CRUD half is
fully verified end to end. The Cloudinary/Resend/Turnstile-dependent paths
(a real upload, a real email send, a real Turnstile check) are **not**
live-verified — credentials remain placeholders — but every one of those
code paths is verified to degrade gracefully (a clean 503, or a skip-and-log
rather than a crash), mirroring the pattern `CloudinaryService` established
in Phase 2. Gallery and Video are deliberately out of scope for Phase 6 —
`phases.md`'s own exit criteria do not list them.

**Group C — `apps/web` is now a real server-rendered site**, not a scaffold:
the full public route tree from `docs/02-architecture/frontend.md`, a
server-only Zod-validated data layer (`server/queries/*`, `React.cache()`-
wrapped), `generateMetadata` + a JSON-LD `@graph` on every route, robots/
sitemap/manifest/feeds, and the HMAC-verified `/api/revalidate` webhook.

**Group D — Conversion + Media & player, scoped:** the real Turnstile
widget wired into `/book` (fixing a bug this session's own credential swap
would otherwise have caused — see STATUS.md), consent-gated analytics
event firing, the Cloudinary image loader + `<CloudinaryImage>` (fixing a
latent OG-image URL bug in passing), and a mini player built as the
masterplan's own documented fallback tier (plain `<audio>`, not
wavesurfer.js) — functionally wired but untested against real audio, since
no track has one yet. Deferred: the admin enquiry inbox (needs Phase 11's
auth to exist safely), gallery/video lightboxes (no backend module),
shader/motion work, self-hosted fonts, dynamic per-entity OG images, split
sitemaps. `apps/admin` is still a **scaffold only**.

One documented gap: `auth/` unit-test coverage — behaviour is fully verified
by 36 e2e tests, but `AuthService` and 4 other classes have no unit tests.
See [ADR 0021](docs/01-decisions/0021-auth-coverage-gap-and-inert-threshold.md).

Read [`docs/06-roadmap/STATUS.md`](docs/06-roadmap/STATUS.md) for the full
account — especially the Group B, C and D sections, which spell out
exactly what "code complete" does and does not mean — then the relevant
[`docs/02-architecture/`](docs/02-architecture/) doc before picking up
Phase 10 (motion) or Phase 11 (admin panel — the CMS itself, the actual
product this whole project is for, and still entirely unbuilt).

**Note for the next session on the API's e2e suite (gap #15):** it assumes
a disposable database reset per run. This session pointed it at the real
Neon database for the first time and its own lockout test locked the real
seeded admin account — run it only against a throwaway database going
forward.

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

pnpm --filter @dj/api test        # unit only, no infrastructure needed
pnpm --filter @dj/api test:e2e    # boots the app; needs Postgres + seeds
pnpm --filter @dj/api openapi:update   # regenerate the committed snapshot

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
| Validation failures are 422 with JSON Pointer errors    | `ZodValidationPipe` + e2e assertions |
| Unknown request properties are rejected, never stripped | `inputObject()` = `.strict()`        |
| The OpenAPI document never drifts from the code         | committed `apps/api/openapi.json`    |
| e2e tests leave seeded content exactly as they found it | restore in `finally` + a double run  |
| A uniqueness pre-check sees soft-deleted rows too       | `anyDeletionState()` from `@dj/db`   |

Do not disable a `dj/*` rule. Fix the code. If a rule is genuinely wrong,
narrow it deliberately and write down why — as was done for
`dj/prisma-only-in-repositories`, which banned domain enums it was never meant
to cover.

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
- **`import './bootstrap-env'` must stay the first line of `apps/api/main.ts`.**
  `@prisma/client` loads `packages/db/.env` at require time and dotenv never
  overwrites, so without it a sibling package's `DATABASE_URL` silently wins
  and the app dials a port no file mentions. Import sorters are a hazard here.
  [ADR 0017](docs/01-decisions/0017-app-env-precedence.md).
- **`@dj/db`, `@dj/contracts` and `@dj/utils` build to CommonJS.** The Nest app
  is CJS and needs `emitDecoratorMetadata`. If a shared-package change seems
  not to take effect in the API, **rebuild the package before debugging
  anything else** — a stale `dist` presents as a missing export.
  [ADR 0016](docs/01-decisions/0016-cjs-builds-for-shared-packages.md).
- **After `pnpm add` anywhere in the workspace, regenerate the Prisma
  client** (`pnpm --filter @dj/db exec prisma generate`) before trusting a
  build failure to be about the code. Installing a new dependency can make
  pnpm resolve a second peer-dependency hash for `@prisma/client`; if
  `packages/db`'s symlink moves to that new, ungenerated copy, `@dj/db:build`
  fails with `Module '@prisma/client' has no exported member 'PrismaClient'`
  — which reads like the schema broke, not like a dependency-install side
  effect.
- **Declare literal routes above parameterised ones.** `@Patch(':id')` above
  `@Patch('reorder')` swallows `/reorder` and tries to update a record named
  `"reorder"` — a 404 that reads like a missing row. Same for `@Get('slugs')`
  vs `@Get(':slug')`.
- **A taxonomy row's `delete` is real, and its joins cascade.** `Genre`,
  `Stat`, `Tag`, `Redirect` and `Settings` have no `deletedAt`, so deleting
  one in use silently strips it from every row that referenced it — Postgres
  does not object. Count references and 409 instead. `NON_PUBLISHABLE` in
  `packages/db/seed/data/rbac.ts` is the list.
- **`isSlugTaken` (and any uniqueness pre-check) must spread
  `anyDeletionState()` from `@dj/db`.** A plain `findUnique` is narrowed by
  the soft-delete extension to `deletedAt: null`, so it reports a slug held
  by a soft-deleted row as free — and the auto-generated slug path then hands
  back one the database rejects. [ADR 0020](docs/01-decisions/0020-any-deletion-state-for-uniqueness-checks.md).
- **Inject the event bus as `DOMAIN_EVENT_BUS`, never as `EventEmitter2`.**
  The upstream type resolves to an error type and propagates as `any`, which
  silently disables type checking on every `emit`. See
  `apps/api/src/common/events.ts`.
- **A cursor must be decoded and applied.** A service that accepts `cursor`
  and ignores it still returns a plausible `nextCursor`, so page 2 is page 1
  and infinite scroll loops forever with no error.
- **e2e tests must not leave seeded content changed.** It is the artist's real
  copy. Never probe a destructive endpoint to prove a permission is absent —
  if the assumption is wrong the test does damage instead of failing.
  [testing.md](docs/04-conventions/testing.md).
- **Never `new Date()` bare** — there is a lint rule. Pass an explicit
  timestamp so tests stay deterministic.
- **Always use `@dj/utils` for dates and money.** IST display, UTC storage,
  `en-IN` rupee grouping, and `isoWithIstOffset` for JSON-LD (a bare `Z` makes
  Google show Indian gigs at the wrong time).
- **Cache tags live in two places and must stay symmetrical** —
  `packages/contracts/src/cache-tags.ts` and the API's `TAG_MAP`. An asymmetry
  fails silently as "I published but nothing changed".
- **A new "is this credential configured" check must match this repo's
  actual placeholder values, not just the documented pattern.**
  `apps/api/.env.local` uses `test`/`re_test`, not `replace-me`, for several
  keys — `CloudinaryService` already special-cases both; `TurnstileService`
  and `MailService` initially matched only `replace-me` and silently believed
  they were configured, attempting real network calls on every request until
  caught by an e2e spec. Copy `CloudinaryService.onModuleInit()`'s exact
  regex, not just its shape, and prefer graceful skip/log over throwing when
  unconfigured — the established pattern for Cloudinary, Resend and
  Turnstile alike.

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
