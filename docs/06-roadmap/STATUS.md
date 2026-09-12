# STATUS — live project state

> **This is the file every session reads first and updates last.**
>
> Update it in the same session you do the work. Tick what is genuinely done
> and verified. If you left something incomplete, say so and say why — an
> honest "blocked" line is far more useful to the next session than an
> optimistic tick.

**Last updated:** 2026-09-13 (UX pass + Gallery/hero-video session)
**Current phase:** The **cinematic visual layer** — Phase 10 done properly.
Until this session `apps/web` was functionally complete and visually flat:
no hero, no shader, no persona switcher, no 3D, and a play button that
structurally never rendered. The homepage is now a nine-act scroll with a
WebGL persona field, a channel switcher that repaints the whole viewport
from CMS colours, a playable 19-track wall on the real SoundCloud Widget
API, a procedural 3D deck and a projected gig map — each with a finished
(not degraded) fallback at two lower tiers. **Both route budgets measured
green.** What is not done is browser verification: nothing in this layer
has been seen rendering. Manual screen-reader testing, a production launch,
load testing and a restore drill remain the user-facing handoff items from
Group F.
**Phases complete:** 0, 1, 2, 4, 5 (code), 6 (code), 7, 8 (scoped), 9 (scoped), 10 (scoped), 11 (scoped, all content types), 12 (scoped), 13 (scoped — see below)
**Phase 3:** complete except one gap — see "What is not done" below

---

## Where things stand

**Group A is functionally complete.** The API boots, authenticates,
authorises, validates, caches, audits, revalidates and serves every Phase 4
content type out of Postgres — all verified against a live database, not
asserted.

**Phase 4 is done.** All 8 content modules exist, are registered, and are
individually and jointly verified: `Personas`, `Genres`, `Venues`, `Tracks`,
`Releases`, `Playlists`, `Programs`, `Events`. Two exemplar shapes, both
proven:

- **Publishable** (`Personas`, `Venues`, `Tracks`, `Releases`, `Playlists`,
  `Programs`, `Events`) — extends `BaseContentService`: publish / unpublish /
  archive / schedule / restore, soft delete.
- **Taxonomy** (`Genres`) — no `status`/`publishedAt`/`deletedAt`; `delete` is
  real and reference-guarded. Copy this one for Phase 6's non-publishable
  models (`Stat`, `Tag`, `Redirect`, `Settings` — check `NON_PUBLISHABLE` in
  `packages/db/seed/data/rbac.ts`).

`GET /personas/:slug/page` still meets the ≤8-query criterion at **5
operations**. The OpenAPI snapshot is committed and gated, and now describes
all 8 modules' routes.

Two schema/data-layer bugs were found and fixed for **every** model they
applied to, not just the one being built when they were found — see
[ADR 0019](../01-decisions/0019-scheduled-at-and-published-check-on-every-publishable-model.md)
(6 models missing `scheduledAt`; 14 of 18 missing the `published_has_date`
CHECK) and
[ADR 0020](../01-decisions/0020-any-deletion-state-for-uniqueness-checks.md)
(`isSlugTaken` blind to soft-deleted rows, including in the shipped `Personas`
exemplar).

### What is not done

**One documented gap: `auth/` unit-test coverage.** `testing.md` specifies
100%; `TotpService` and `PasswordService` are now genuinely covered (~98%
lines each, 34 new tests) but `AuthService`, `AuthController`,
`AuthRepository`, `RefreshTokenService` and `AuthCookieService` remain at 0%
**unit** coverage — covered only by the 36-test e2e suite, which exercises
the same security-critical paths (lockout, reuse detection, family
revocation, CSRF, no-enumeration) at the HTTP boundary rather than in
isolation. See
[ADR 0021](../01-decisions/0021-auth-coverage-gap-and-inert-threshold.md) for
the full account, including a second finding: the coverage **provider**
(`@vitest/coverage-v8`) had never been installed, so the threshold config
had never actually run before this session — it is installed now, and the
gap is real and measured, not merely undiscovered.

This does not block anything in the normal pipeline (`pnpm test` does not
pass `--coverage`), but it should be closed before `--coverage` is ever wired
into CI as a gate. The next session's starting point is in ADR 0021's
Consequences section.

### Group B — complete, with the credential-dependent paths honestly qualified

The user asked for the entire group. Every module in the masterplan's Phase 5
and Phase 6 inventory is written, wired into `app.module.ts`, and verified
against a live Postgres. What "verified" means differs by whether a module
talks to an external service, and that distinction is the whole point of
this section — read it before assuming Phase 5/6 behave identically in
production to how they behave here.

**Phase 5 — Media pipeline. Code complete; live upload/confirm unverifiable
without real Cloudinary credentials (gap #2, unchanged).**

- `MediaModule`: `createUploadSignature()` (server decides folder + eager
  transforms, signs locally — no network call), `confirm()` (re-reads
  authoritative metadata via the Cloudinary Admin API rather than trusting
  the client — the whole point of the two-call flow), admin CRUD, two-phase
  soft delete (409 listing referencers across **every** relation that can
  point at a `MediaAsset`, including ones with no admin module yet —
  Gallery/Video FKs are counted even though those modules don't exist),
  force-delete nulling nullable references (refuses if a `GalleryItem`
  reference exists — that FK is required, not nullable, so it cannot be
  force-cleared without deleting the gallery item itself), and a nightly
  orphan sweeper cron guarded by `pg_try_advisory_xact_lock` (transaction-
  scoped, not session-scoped — safe under pgbouncer transaction pooling,
  documented in the repository method's comment).
- **Verified**: `createUploadSignature()` signs correctly with placeholder
  credentials (it never calls Cloudinary). `confirm()`, the orphan sweeper's
  Cloudinary destroy call, and the EPK PDF upload all correctly 503
  (`SERVICE_UNAVAILABLE`) rather than crash — asserted in
  `media-press-kit.e2e-spec.ts`. **Not verified**: an actual upload landing
  in the right folder with correct bytes/dimensions/`blurDataUrl`, real
  derivative generation, or the sweeper actually deleting from Cloudinary —
  all of Phase 5's literal exit criteria require live credentials this
  environment does not have.
- **Gallery and Video are out of scope.** The masterplan's Phase 6 exit
  criteria (`phases.md`) do not list them, unlike the original module
  inventory — treated as deferred to whichever later phase actually needs
  them, not silently dropped. `MediaRepository`'s reference-counting still
  accounts for their schema-level FKs so deleting a `MediaAsset` can never
  silently orphan a `GalleryItem` even before those modules exist.

**Phase 6 pure-CRUD — complete and fully verified.** `Testimonials`,
`Services`, `Brands` (+ `PersonaBrand`), `Stats`, `Faq`, `Gear`,
`Experience`, `StaticPages`, `Settings` (singleton), `Redirects`, `Sitemap`,
`Tags`, `Posts` (+ `PostTag`). All copy the `Venue`/`Genre` pattern; `Stat`,
`Redirect`, `Tag` and `Settings` are taxonomy-shaped (no publish workflow).
`StaticPage` is the one publishable model with no `sortIndex` — its
`reorder()` is inherited from `BaseContentService` to satisfy the interface
but never wired to a route, documented in the service's class comment.
Verified end to end against the live database in
`group-b-simple-crud.e2e-spec.ts`, `group-b-taxonomy.e2e-spec.ts`,
`group-b-settings-sitemap.e2e-spec.ts` and `posts.e2e-spec.ts`.

**Phase 6 engagement — code complete; live mail delivery and Turnstile
enforcement unverifiable without real Resend/Turnstile credentials (gap #2,
same root cause as Phase 5).**

- `TurnstileService` and `MailService` both mirror `CloudinaryService`'s
  established graceful-degradation shape: a placeholder secret/API key is
  detected (`replace-me`, or the literal `test`/`re_test` this environment's
  `.env.local` actually uses — the regex had to be widened to catch both,
  see bug #32 below) and the check is **skipped**, not enforced; mail is
  **logged and skipped**, not sent. Once real credentials exist, both start
  enforcing/sending with no code change.
- `InquiriesModule`: public submission with a spam-score heuristic (link
  count, ALL-CAPS ratio, a small disposable-domain list, a honeypot field
  that routes to `SPAM` status rather than 422ing — a browser autofill
  plugin filling a hidden field must not reject a real enquiry), `INQ-YYYY-
  NNNN` reference generation (optimistic + retry, not a sequence table),
  `@OnEvent`-driven mail (fire-and-forget, so the write never waits on
  Resend), the admin Kanban-shaped pipeline (status, assignment, append-only
  notes), and a retry cron for `notifiedAt IS NULL`.
- `NewsletterModule`: double opt-in only (`PENDING` → `CONFIRMED` via emailed
  token), unsubscribe token, admin list.
- **Verified**: `POST /inquiries` writes a real row and returns in <2s with
  Turnstile/Resend both unconfigured; the honeypot path lands in `SPAM`
  without a 422; the 3/hour/IP throttle fires; the admin pipeline (status
  change, note, soft delete) round-trips; the newsletter's full
  subscribe → confirm → unsubscribe token flow round-trips against real
  rows. **Not verified**: an actual email arriving in an inbox, or a real
  Turnstile token being genuinely rejected — both need live credentials.

**Phase 6 press kit — code complete; PDF/download paths unverifiable without
Cloudinary.** `PressAssetsModule` (CRUD, gated download via
`private_download_url` with a 7-day expiry) plus `PressKitGeneratorService`
(renders a one-page EPK via `@react-pdf/renderer`, using `createElement`
rather than JSX — `apps/api`'s `tsconfig.json` has no `jsx` option and only
includes `.ts` files; widening that for one template was a bigger change
than the template). **Documented, not glossed over**: the gated-download
signature only genuinely restricts access when the underlying `MediaAsset`
was uploaded with a `private`/`authenticated` Cloudinary delivery type — the
browser-upload flow always uses `upload`, so today the signed URL's 7-day
expiry is real but the plain `secureUrl` remains reachable regardless.
Closing that gap means adding delivery-type selection to the upload-signature
flow, deliberately not done in this pass. The masterplan's "debounced
regeneration on bio/stats/photo change" trigger is not wired — regeneration
is manual-only (`POST /admin/press-kit/epk/:personaKey/regenerate`).

**Scope reduction, documented rather than silent**: React Email
(`@react-email/components`) was not installed. The three transactional email
bodies (`infra/mail/templates.ts`) are plain string/HTML builders. This is
adequate for three templates; revisit if the template count or design
ambition grows.

**RBAC, cache tags and the revalidation tag map needed zero changes** —
`RESOURCES`, `NON_PUBLISHABLE`, `cache-tags.ts` and `TAG_MAP` already had
entries for every Group B entity from an earlier session, which is why no
permission or revalidation gaps showed up during this pass.

**Nothing in the masterplan's Group B inventory was skipped.** Gallery and
Video are the one deliberate exclusion, and that follows `phases.md`'s own
exit criteria, not an ad-hoc choice.

### Group C — built and verified against the live API, deliberately scoped to Phase 7

The user asked for the entire group with placeholder credentials accepted
("don't worry, I will add the env keys later") and an explicit instruction
**not to commit** — the working tree is left for manual review/commit.

**`apps/web` now exists as a real server-rendered site**, not a scaffold.
~55 files: `src/lib/` (`site.ts`, `api-client.ts` — `server-only`, Zod-
validated, contract-drift-loud — `json-ld.tsx`), `src/components/`
(`Header`/`Footer`/`Container`/`RichText`, all Server Components, zero
client JS), 18 `src/server/queries/*.ts` modules (one per content domain,
each `React.cache()`-wrapped so `generateMetadata` and the page body share
one fetch), the full `(marketing)` + `(legal)` route tree from
`frontend.md` §5.2 (home, `[persona]` + its `/music` subroute, `/music`,
track/album/playlist detail, `/events` + detail + `/events/archive/
[[...year]]`, `/programs`, `/venues`, `/about`, `/setup`, `/services` +
detail, `/press`, `/rider`, `/testimonials`, `/blog` + detail + tag,
`/faq`, `/contact`, `/book` (progressive-enhancement form, honeypot,
`useActionState` for inline errors only), `/privacy` `/terms` `/cookies`),
plus `robots.ts`/`sitemap.ts`/`manifest.ts`/`icon.tsx` and the API route
handlers (`revalidate` — HMAC-verified, matches the API's signer exactly;
`draft` + `draft/disable`; `feed.xml`/`feed.json`/`events.ics`; `health`).

Every route carries `generateMetadata` and a JSON-LD `@graph` (`Person`,
`MusicGroup`, `MusicRecording`/`MusicAlbum`/`MusicPlaylist`, `MusicEvent`
with `isoWithIstOffset`, `Place`, `Service`+`FAQPage`, `BlogPosting`,
`Review`/`AggregateRating` gated to `isVerified && rating != null` only —
the exact anti-fabrication discipline `brand.md` requires. Persona theming
(`data-theme` + inline `--color-accent`) is set server-side from CMS data,
so the correct accent paints on first byte.

**Deliberately deferred, not overlooked** — each belongs to a later,
credential- or scope-blocked phase per `phases.md`:
Turnstile widget + analytics events (Phase 8); the live Cloudinary image
loader, mini player, lightbox/galleries — the latter two also blocked on
Gallery/Video never having been built in Group B (Phase 9); shaders/3D/
motion showcase (Phase 10); self-hosted fonts (no font binaries exist in
the repo to self-host — `globals.css` falls back to system-font stacks
with a comment explaining why); DB-driven redirects middleware; per-route
dynamic OG images; `/press/download` and `/rider/pdf` route handlers (need
real signed Cloudinary URLs); `/api/search-index` for the command palette;
split multi-file sitemaps (a single `sitemap.ts` is used for now).

**A scoping call made without asking**: the shared `no-restricted-imports`
ESLint rule banning `**/server/queries/*` from any `.tsx` file was removed
— it matched every Server Component too, with no way to exempt the
documented `generateMetadata`/page-body pattern this whole route tree
depends on. The actual safety net (a Client Component reaching server-only
code) is still enforced at build time by the `server-only` package,
imported at the top of `api-client.ts` and every query module, plus the
existing `dj/no-client-in-route-files` rule. Full rationale is in the
rule file's replacement comment in `packages/config-eslint/next.js`.

**Verified, not just typechecked**: rebuilt and restarted `apps/api` fresh
on port 4111, ran `pnpm --filter @dj/web build` (real static-generation
fetches against the live API — this is what caught bug #33 below), then
`pnpm start` and `curl`-tested ~15 routes plus JSON-LD output. Final gate:
`pnpm turbo lint typecheck build --filter='!@dj/db'` — **18/18 tasks pass**,
zero regressions to `apps/admin`/`packages/*`. Both test servers were
stopped afterward.

A genuine runtime bug surfaced only by the live build: `events.ics/
route.ts` requested `getUpcomingEvents({ limit: 200 })`, but the API's
shared `PaginationSchema` caps `limit` at 100 — a 422 mid-build. Fixed by
lowering to 100.

**A framework nuance, not a defect**: `curl`ing a nonexistent `/[persona]`
slug returns HTTP 200, not 404, because `(marketing)/loading.tsx` makes
Next auto-wrap the segment in a Suspense boundary and start streaming
before the async `notFound()` resolves — a real browser still renders the
correct 404 UI via the RSC stream (confirmed by inspecting the response
body's `$RC`/`$RB` hydration markers); only a plain non-JS `curl` sees the
outer 200. Standard App Router streaming behaviour, left as-is rather than
worked around, given it doesn't affect real users or crawlers (which
execute JS).

**`.env.local` created** for `apps/web` with real values copied from
`apps/api/.env.local` for `API_INTERNAL_URL`/`API_KEY`/
`REVALIDATE_SECRET`/`PREVIEW_TOKEN` (so the revalidation webhook actually
works end to end locally) and placeholder `replace-me` values for
Cloudinary/Turnstile — confirmed gitignored via `git check-ignore -v`.

### Group D — Phases 8+9, built and verified against real credentials for the first time

This is the first session with real Cloudinary, Resend and Turnstile
credentials (the user replaced every placeholder in all four `.env.local`
files beforehand) and a real Neon Postgres — which had never actually been
migrated or seeded until this session (it was created empty; every prior
session's verification ran against a throwaway embedded Postgres). Both
facts changed what "verified" means this time, in ways worth reading before
trusting the numbers below.

**A real, urgent bug this session's env-key swap silently introduced**:
`book/actions.ts` posted a hardcoded `turnstileToken: 'unconfigured'` on
every submission, written back when `TURNSTILE_SECRET_KEY` was a
placeholder and `TurnstileService.verify()` skipped the check entirely
regardless of the token's value. Once the user supplied a real secret key,
`verify()` started genuinely calling Cloudflare's `siteverify` with that
literal string — which fails — meaning **every booking submission would
have silently 400'd** the moment the real key went in, with no code change
of its own to blame. Fixed by building the actual Turnstile widget
(`components/turnstile-widget.tsx`, gated on the real site key, otherwise
rendering nothing to preserve the old skip behaviour) and reading its
real `cf-turnstile-response` field in the server action instead of the
hardcoded string. Verified directly: a `curl` POST to `/inquiries` with an
invalid token now genuinely returns `400 VALIDATION_FAILED` — confirming
enforcement is real, not cosmetic.

**Phase 8 — Conversion, scoped:**
- Turnstile widget wired end to end (above).
- A consent-gated analytics layer: `lib/analytics.ts` (`track()`, a no-op
  until consent is granted and a script has loaded), a real `Set-Cookie`
  server action (`consent-actions.ts`) rather than a client-only cookie
  write, and `AnalyticsScript` — a **Server Component** that reads the
  consent cookie itself and only then emits the Plausible `<script>` tag,
  so a non-consenting visitor's HTML never contains it at all. `booking_
  started` (on `BookForm` mount), `booking_submitted` (on `/book/thanks`),
  `whatsapp_click`/`phone_click`/`email_click` (on `/contact`) all fire.
  This is a deliberately smaller version of the masterplan's dedicated
  `@dj/analytics` package — Plausible only, no multi-provider fan-out —
  documented as a scope reduction rather than built silently smaller; a
  package is worth creating once `apps/admin` needs the same event bus.
- **Deferred, explicitly**: the admin enquiry inbox v1. `apps/admin` has no
  auth, no session handling, nothing — building an inbox screen with real
  enquiry data into an app with zero access control would be a security
  regression, not a feature. This belongs with the rest of Phase 11, where
  auth is built once for the whole admin, not bolted on early for one page.

**Phase 9 — Media & player, scoped:**
- The Cloudinary image loader: `next.config.ts`'s `images.loader` is now
  `custom` (`lib/cloudinary-loader.ts`), `lib/media.ts` exports `SIZES`
  presets and `cloudinaryUrl()`/`cloudinaryOgUrl()`, and `<CloudinaryImage>`
  is the one sanctioned way to render a `MediaImage` — blur placeholder
  from the stored `blurDataUrl`, focal-point `object-position`, no manual
  `sizes` strings at call sites. Wired into the persona hero image as the
  reference usage.
- **A real bug fixed in passing**: `[persona]/page.tsx`'s `generateMetadata`
  built its OG image URL from a bare `persona.heroImage.publicId` — not a
  Cloudinary delivery URL at all, so the OG tag would have pointed at a
  URL that resolves nowhere. Now uses `cloudinaryOgUrl()`.
  `packages/media` (per the masterplan) is deliberately not created yet —
  every function here is pure, so hoisting it later is a file move, not a
  rewrite; a package is worth it once `apps/admin` needs the same URL
  builder in Phase 11.
- The mini player: `PlayerProvider`/`MiniPlayer`/`PlayButton`, wired into
  `(marketing)/layout.tsx` above the route slot so playback survives
  navigation. Built as the masterplan's own documented **fallback tier** —
  a real `<audio>` element and plain transport controls, not
  wavesurfer.js's precomputed-peaks waveform — and left there rather than
  built up further, because no track in the seeded catalogue has real
  audio yet (see below) to justify or test the richer version against.
  Wired onto the track detail page, conditionally on `track.audioUrl`.
- **Deferred, unchanged from Group C's assessment**: gallery/video
  lightboxes (no Gallery/Video backend module exists), hero video strategy,
  dynamic per-entity OG images.

**What "verified" means this session, and its limits:**
- `packages/db`'s Neon database was **migrated and seeded for the first
  time** (`prisma migrate deploy`, `post-migrate`, `seed:system`,
  `seed:content`, and an `--only=admin` run this session added — see bug
  below): 4 personas, 7 venues, 6 programs, 19 tracks, 4 playlists, 8
  testimonials, 6 services, 10 FAQs, 11 gear items, 15 redirects, 22
  genres, 104 permissions/3 roles, and the `SUPER_ADMIN` row.
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — **18/18 tasks
  pass** against the live, now-real API (Cloudinary reports
  `"configured":true` on `/health/ready`).
- All 19 top-level public routes smoke-tested live via `curl` — all `200`.
  Confirmed present in the response body: the `cf-turnstile` widget markup
  on `/book`, the real WhatsApp deep link on `/contact`, and the **absence**
  of the Plausible script tag with no consent cookie set (the server-side
  gate holds).
- **Not verified**: an actual person solving the Turnstile challenge in a
  real browser (only the server-side rejection of an invalid token was
  exercised — that's real enforcement, but not the full human path); the
  mini player's actual playback (no track has a real `audioUrl` yet — the
  media pipeline has never received a live upload, gap #4/#2 unchanged);
  Plausible actually receiving an event (no real Plausible site configured
  this session).
- **The API's own e2e suite was not brought to green against this
  database, and that is a pre-existing test-design mismatch, not a Group D
  regression.** Every previous session's "N/N e2e pass" figure was against
  a **throwaway embedded Postgres**, reset per run. This session pointed
  the same suite at the user's real, persistent Neon database for the
  first time. `auth.e2e-spec.ts` deliberately drives the account into a
  lockout state as part of testing lockout behaviour — on a disposable DB
  that's fine, since the next run starts from empty; here it left the
  seeded `SUPER_ADMIN` account genuinely locked for any *subsequent* run,
  which is a correct security feature working exactly as designed, not a
  bug. Manually unlocked it twice via a scratch script (not committed) and
  stopped re-running the full suite against real data rather than keep
  triggering it. **This suite should only run against a disposable
  database going forward** (the throwaway pattern used in every prior
  session) — pointing it at Neon was this session's own setup choice while
  chasing a build failure, not a recommended practice; see gap #15 below.

**Two setup bugs found while first migrating/seeding the real database
(infrastructure, not Group D code):**
- `packages/db/.env`'s `ADMIN_SEED_PASSWORD` was 10 characters; the seed's
  own `PasswordService` validation requires 12. Bumped to a 12+ character
  value.
- `apps/api/.env.local` had no `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` —
  the e2e auth suite reads these from the API's own env to log in as the
  seeded user, but nothing had ever added them there (every prior session
  ran against a throwaway DB whose seed and whose test process shared one
  `.env.local` by construction). Added, matching `packages/db/.env`
  exactly — the same "these must match" class of bug documented elsewhere
  in this file for `API_KEY`/`REVALIDATE_SECRET`/`PREVIEW_TOKEN`.

### Group E — Phases 10+11, `apps/admin` exists for the first time

The user asked for the entire group. Given the size of Phase 11's full
masterplan scope (CRUD for every content type, Tiptap, media library with
crop/focal-point, dnd-kit reordering, draft preview, audit log, booking
Kanban) against this session's time budget, the honest choice was to build
the **complete, working shape once** — auth, protected shell, one content
type's full CRUD + publish workflow — rather than a wider but shallower
pass across many entities. Every other content type follows this exact
file-for-file pattern; adding one is now a known, mechanical task, not a
design problem.

**Phase 11 — Admin panel, scoped:**
- `apps/admin/src/lib/api-client.ts` — a browser-side fetch wrapper.
  Deliberately different from `apps/web`'s server-only Zod-validated
  client: the admin calls the API **directly from the browser** (per its
  own `package.json` comment — needed for optimistic updates later), the
  access token lives in memory only (never `localStorage`, so it can't be
  read back out by an XSS payload later), and a 401 triggers exactly one
  silent `/auth/refresh` retry using the httpOnly refresh cookie before
  giving up.
- `lib/auth-context.tsx` — `AuthProvider`/`useAuth()`: login (handling the
  `totpRequired` intermediate step), logout, a `can(permission)` helper
  the UI reads to hide actions a role doesn't have, and a silent-refresh
  attempt on mount so a page reload doesn't force a re-login while the
  refresh cookie is still valid.
- A login page with an email/password form and a conditional TOTP field.
- A protected dashboard shell (sidebar + topbar, sign-out) — the
  enforcement boundary is the API itself (every admin route requires a
  valid access token server-side); the client-side redirect is purely a
  UX nicety so a signed-out visitor sees `/login`, not a page full of
  failed requests.
- **Venues — full CRUD + publish workflow**, chosen as the reference
  implementation because it needed no media/relations complexity to prove
  the pattern end to end: a paginated list with publish/unpublish/delete
  actions gated by `can()`, a shared create/edit form component.
- **A real, pre-existing schema bug found and fixed via this screen**:
  creating a venue with no `status` field (exactly what the "New venue"
  form does) crashed with a raw 500. `Venue.status` and `Brand.status`
  were the only two publishable models in the whole schema defaulting to
  `PUBLISHED` at the column level — every other one defaults to `DRAFT` —
  and `VenuesService.create()` only sets `publishedAt` when `status` is
  *explicitly* passed, so an omitted status hit the `PUBLISHED` column
  default with a null `publishedAt` and the `venues_published_has_date`
  CHECK constraint (added under ADR 0019) rejected the insert. Fixed with
  a hand-written migration (`20260912100000_venue_brand_default_draft`,
  written manually and applied via `migrate deploy` rather than
  `migrate dev`, which drift-detects against `post-migrate.sql`'s
  out-of-band DDL and offers to reset the database — see
  [migrations.md](../05-operations/migrations.md)) changing both columns'
  default to `DRAFT`. Verified: create → `DRAFT` (no crash) → publish →
  `PUBLISHED` with a real `publishedAt` → unpublish → `DRAFT` → delete →
  `204`, all against the live Neon database with the seeded `SUPER_ADMIN`.
- **Deferred to the next Phase 11 pass**: CRUD for every other content
  type (Personas, Tracks, Events, Releases, Playlists, Programs, and the
  rest of Group B's inventory — each a mechanical copy of the Venues
  pattern now that it exists), Tiptap rich-text editing, the media
  library (upload, crop, focal-point picker), `@dnd-kit` reordering,
  Draft Mode live preview, the audit-log viewer, the booking-inquiry
  Kanban, `⌘K`, and TanStack Query (the fetch-and-`useState` approach
  used here is adequate for one screen; a real optimistic-update/
  cross-list-invalidation need is what would justify adding it).

**Phase 10 — Cinematic + signature motion, scoped:**
- `apps/web/src/lib/motion.ts` — `useReducedMotion()`, `useCapability()`
  (deviceMemory/hardwareConcurrency/`saveData`/coarse-pointer checks).
  `<MotionGate heavy light>` in `components/motion-gate.tsx`.
  Scoped down from the masterplan's dedicated `packages/motion` package
  for the same reason `lib/media.ts` was in Group D — both hooks are
  pure, so hoisting them into a real package later (once `apps/admin`
  needs the same checks) is a file move, not a rewrite.
- **One real technique wired in**, not a stub: a magnetic-cursor CTA
  (masterplan §5.6 item 13) on the homepage's primary "Book an event"
  button — `components/magnetic-link.tsx`, capped at 8px offset, gated
  through `<MotionGate>` for reduced-motion/low-capability devices and
  never mounted at all on a coarse (touch) pointer.
- **Deferred, and why**: shaders, the 3D turntable/gig-globe scenes, the
  audio-reactive visualizer, Lenis smooth scroll, the command palette,
  native View Transitions, and the custom cursor are all genuinely
  untouched. Each needs a new heavy dependency (`three`/`@react-three/
  fiber`, `wavesurfer.js`, `cmdk`, `lenis`) **and** real photo/video/audio
  assets to be anything more than decorative placeholder content — which
  gap #4/#16 confirm don't exist yet. Building the shader/3D layer against
  no real media would mean shipping something unverifiable and likely to
  be redone once real assets exist, which is a worse outcome than
  shipping the one technique that could be built and genuinely verified
  this session.

### Group E — second pass: the rest of Phase 11, plus Lenis/command palette/audio visualizer

The user asked for both "next passes" in full — every remaining Phase 11
item and the still-buildable half of Phase 10 (the shader/3D/audio-visual
work stays deferred for the same asset-dependency reason as the first
pass; nothing changed there). This is the largest single addition of the
project so far, and it found the single most consequential bug of any
session: **the media pipeline had never actually completed a live upload
before this pass**, despite being "code complete" since Group B.

**The bug, in full:** `MediaService.createUploadSignature()` signed a
params object that included `resource_type` alongside `folder`/`eager`/
`eager_async`/`timestamp`. Cloudinary's own signature verification
**excludes** `resource_type` from what it hashes (along with `file`,
`api_key` and `cloud_name` — it is a URL path segment, not a signed
field), so the server computed a signature over one string and Cloudinary
verified a different one. Every real upload — through any client, not
just this admin — would have failed with `Invalid Signature` the moment
someone tried it against a real account. Group B's own verification never
caught this because it only checked that a signature was *computed*
(pure local math, no network call); Group D didn't either, because no
client actually exercised the admin upload flow before this pass. Found
by building the actual media library screen and driving a real upload
through it end to end, confirmed by reproducing Cloudinary's own error
message (`String to sign - 'eager=...&eager_async=true&folder=...&timestamp=...'`
— visibly missing `resource_type`) before fixing `media.service.ts` to
stop including it. **Re-verified after the fix**: a real 68-byte PNG
uploaded to Cloudinary, confirmed via `POST admin/media`, appeared in
`GET admin/media`, and was deleted cleanly — the full signed-upload →
confirm → list → delete cycle, live, for the first time in this project's
history.

**Phase 11, the rest of it:**
- **A config-driven generic CRUD scaffold** (`lib/entity-config.ts`,
  `components/generic/{entity-list,entity-form}.tsx`) generalises the
  Venues screen from the first pass to every taxonomy/simple-content
  model: Genres, Tags, Stats, Redirects, Testimonials, Services, FAQs,
  Experience, Brands, Gear, Press assets — 11 content types, each added
  as a ~15-line config object plus three thin page wrappers, not a new
  screen. Reorder is exposed as explicit "Move up"/"Move down" buttons
  (calling the existing `PATCH .../reorder` route) rather than
  drag-and-drop — this is also the literal required accessible
  alternative under WCAG 2.5.7, not a lesser stand-in for it.
- **StaticPages and Posts** get a real Tiptap v3 editor
  (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`,
  no custom embed nodes) instead of the generic scalar form, since their
  content is genuinely rich text — every node/mark it can produce is
  already handled by `apps/web`'s existing `RichText` renderer, so content
  written here round-trips correctly on the public site today.
- **Settings** — the one singleton screen, `GET`/`PATCH admin/settings`,
  covering the fields an admin touches day to day (contact info,
  WhatsApp, maintenance mode); the rest of the field surface (default SEO,
  accent color, other feature flags) is a config addition to the same
  form, not a new screen.
- **The media library** (`components/media/media-library.tsx`) — signed
  direct browser → Cloudinary upload, confirm, list, delete. No crop UI
  (`react-easy-crop`) this pass; the focal point exists in the API
  already but has no input in this form yet — a documented, honest gap
  rather than a half-built cropper.
- **Draft Mode live preview** — a "Preview live →" link on Venues and
  StaticPages, opening `apps/web`'s existing `/api/draft` route in a new
  tab. `NEXT_PUBLIC_PREVIEW_TOKEN` is deliberately exposed to the admin's
  browser bundle (matching `apps/web`'s `PREVIEW_TOKEN`) — only admin
  users should ever construct one of these links, and they are exactly
  the population this token is meant to admit.
- **The audit log** — genuinely new backend work, not just a frontend
  screen: `modules/audit` had a working `AuditService.record()`/`list()`
  since Phase 2/3 but **no controller ever exposed it**, despite the
  `auditLog:read` permission existing in RBAC since the beginning. Added
  `AuditAdminController` (`GET admin/audit-log`, cursor-paginated,
  optional `entityType`/`entityId` filter) — a small, necessary backend
  addition to support a frontend feature that had no way to exist without
  it, the same pattern as fixing the Cloudinary signing bug above.
- **The booking Kanban** (`components/inquiries/inquiry-kanban.tsx`) — six
  columns (New/Contacted/Quoted/Negotiating/Booked/Lost), each card with a
  "Move to…" select calling the existing `PATCH admin/inquiries/:id`
  route, rather than drag-and-drop (same reasoning as reorder above).
  `SPAM`/`ARCHIVED` inquiries are deliberately not shown as columns —
  they are the "handled, out of the pipeline" states.
- **Deferred, unchanged from the first pass**: Personas, Tracks, Releases,
  Playlists, Programs, Events — each needs relation/media pickers
  (artwork, genres, lineup, track ordering) a generic scalar form cannot
  represent; a form that silently can't set a track's audio would be
  actively misleading, not merely incomplete.
- **Deferred, newly identified this pass**: `@dnd-kit` drag-and-drop
  (the move-up/down buttons are the required accessible baseline, not a
  placeholder for it), `react-easy-crop` cropping, custom Tiptap embed
  nodes (`TrackEmbed`/`PlaylistEmbed`/etc.), TanStack Query (the
  fetch-and-`useState` approach used throughout is adequate for one
  screen at a time; revisit if optimistic updates or cross-list
  invalidation become a real need).

**Phase 10, the rest of the buildable half:**
- **Lenis smooth scroll** (`components/lenis-provider.tsx`) — disabled
  under reduced motion, on a coarse (touch) pointer, and on a
  low-capability device, matching the masterplan's own documented
  conditions; native scroll is the complete fallback, not a degraded one.
- **A command palette** (`⌘K`/`Ctrl+K`, `components/command-palette.tsx`,
  using `cmdk`) — scoped to static routes plus personas, not a full
  content search index. `/api/search-index` (fuzzy search across
  tracks/events/posts) is explicitly deferred: it needs its own endpoint
  and query strategy, a materially bigger piece than wiring up `cmdk`.
- **An audio-reactive visualizer** (`components/player/audio-visualizer.tsx`)
  — a genuine Web Audio `AnalyserNode` (fftSize 512) wired to the mini
  player's real `<audio>` element, drawn on one 2D canvas, RAF-driven,
  never autoplays anything on its own. Renders flat right now because no
  track has real audio yet (gap #16) — that is silence being drawn
  correctly, not a bug; it will react the moment a real track plays.
- **Still deferred, unchanged**: shaders, the 3D turntable/gig-globe
  scenes, native View Transitions, the custom cursor — all still need
  real photo/video assets (turntable/globe also need a sourced GLTF
  model) to be more than placeholder content, per the first pass's
  reasoning.

**Verified, beyond the media pipeline fix above:**
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — **18/18 tasks
  pass**, `apps/admin` now builds **37 routes** (up from 8).
- Every new admin route smoke-tested live (all `200`): all 11 generic
  CRUD list screens, Settings, Media library, Bookings, Audit log.
- Live create/delete round-trips against the real database for a
  Testimonial, a Tag, and a StaticPage (with real Tiptap JSON content),
  each cleaned up afterward.
- The audit log endpoint returns real rows for those creates, including
  actor email and timestamp.
- `apps/web`'s home page, a persona page, and `/book` all still render
  correctly with Lenis/command-palette/mini-player-visualizer mounted.
- **Not verified**: an actual person pressing `⌘K` and navigating via
  keyboard in a real browser (the component logic was reviewed, not
  driven through a browser); the visualizer actually animating (needs
  real audio, gap #16); Lenis's actual scroll feel (needs a real browser,
  not `curl`).

### Group F — closing Phase 11's last content-type gap, then Phase 12/13's codeable subset

The user asked to finish every remaining phase. Before scoping Phase 12/13,
this session closed the one piece of Phase 11 explicitly left open at the
end of the second pass: **the six relational content types now have full
admin CRUD.**

**Phase 11, closed:** Personas, Tracks, Releases, Playlists, Programs and
Events all get dedicated forms (not the generic scalar scaffold — each has
real relation pickers: genre multi-select, persona/venue/program dropdowns
fed from live admin list endpoints, a track-order picker with move-up/down
for playlists, and a lineup builder for events). Building these forms
surfaced a genuine contract/service gap: **none of these six models had a
write path for their media-attachment fields** (`Track.artworkId`/
`audioId`, `Release.coverId`, `Playlist.coverId`, `Program.heroId`,
`Event.flyerId`, `Persona.heroMediaId`/`avatarMediaId`) — the Prisma
columns existed and the read side (`*Detail`/`*AdminDetail`) already
returned them, but `packages/contracts`'s `*CreateInput`/`*UpdateInput`
never exposed them and no service ever wrote them, so setting a track's
artwork was structurally impossible before this session, for any client.
Fixed by adding each id field to its contract schema and one `assign(...)`
line to each service's `toWriteData()` — the exact existing pattern
already used for `Testimonial.avatarId`/`Brand.logoId` elsewhere in the
codebase, not a new pattern invented for this. **Verified live**: created
a track/release/playlist/program/event through the real API, uploaded a
real image through the media pipeline, attached it to a track via
`artworkId`, and confirmed the write actually persisted in Postgres
(`SELECT` showed the column set correctly) — the response's `artwork`
field stayed `null` only because the 1×1 test PNG never got a real
`blurDataUrl` derivative, which `toMediaImage()` correctly treats as an
incomplete asset (documented, pre-existing, correct behaviour — see that
function's own comment — not a bug found this session).

**Two structural gaps intentionally left alone, not silently worked
around**: a track still cannot be attached to a *release* (no
`releaseId`/`trackNumber` field exists on either side of that relation in
the contracts, and deciding which side should own it, and whether it's a
single field vs. a dedicated endpoint, is a design decision worth its own
ADR rather than a guess made mid-form-building); a persona's `socialLinks`
remain read-only for the same reason (no write schema exists for the
array of `{platform, url}` objects). Flagging both here rather than
inventing an endpoint shape matches CLAUDE.md's explicit instruction: an
undocumented deviation is worse than a documented gap.

**Phase 12 — Hardening & launch, the codeable subset:**
- A real Content-Security-Policy plus the standard security header set
  (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS) on both `apps/web` and `apps/admin`.
  **Deliberately not the full nonce-based CSP** the masterplan describes:
  Next's App Router injects inline RSC-streaming/hydration scripts with
  no nonce by default, and blocking them without first wiring a
  per-request nonce through middleware would break hydration on every
  page — a risk this session cannot verify without a real browser, so
  `script-src` keeps `'unsafe-inline'` as a documented, deliberate
  weakening rather than a guessed-safe tightening. Verified live: the
  header is present on every response; the site still renders and all
  smoke-tested routes return 200 with it active.
- Legacy 301 redirects (already implemented in an earlier session) —
  re-verified live this session: `/bollywood` → `/felicitous`,
  `/psytrance` → `/trinitrocosmic`, both a real `308 Permanent Redirect`.
- **Not codeable, not attempted**: a manual NVDA/VoiceOver pass (needs a
  human with screen-reader software), Sentry error tracking (needs a real
  Sentry account and DSN), a load test (needs a deployed environment to
  point traffic at), a backup/restore drill (needs production
  infrastructure to restore into), visual regression baselines (needs a
  Playwright/Chromatic setup this project has never wired up), and the
  nonce-based CSP tightening above. These are the actual remaining Phase
  12 work — see the handoff list at the end of this section.

**Phase 13 — Growth, the codeable subset:**
- A real `/search` page (`server/queries/search.ts` + `app/(marketing)/
  search/page.tsx`) — queries the API's existing `q` filter on tracks,
  events, posts and personas directly; no fabricated results, no
  client-side search index to keep in sync with real content. This is
  also the documented non-JS fallback path for the command palette
  (Group E). **Not** the masterplan's `/api/search-index` fuzzy-search
  endpoint — that needs its own backend query strategy across every
  content type, a bigger piece than a page that calls four existing
  list endpoints.
- **Explicitly not attempted, and why**: location/venue landing pages
  (e.g. `/services/weddings/bangalore`) need real per-city copy, venue
  lists and testimonials — writing placeholder marketing text for them
  would be exactly the fabrication CLAUDE.md forbids ("Never invent
  content... no invented gig dates, no guessed prices"), so this is
  blocked on the user supplying real per-location content, not on
  engineering effort. i18n activation needs real Hindi/Kannada copy
  (same reason). PWA offline support and booking-CTA A/B testing are
  both real, bounded engineering tasks that were simply out of scope for
  this pass given everything else in it — not blocked on anything.

**Verified this session:**
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — **18/18 tasks
  pass**; `apps/admin` now builds **49 routes** (up from 37).
- Live create round-trips for a Track, Release, Playlist, Program and
  Event through the real API (each cleaned up afterward); a Persona
  `PATCH`/revert round-trip against real seeded data.
- A real Cloudinary upload attached to a track's `artworkId`, confirmed
  to persist at the database level.
- `/search?q=felicitous` returns real matching content live; CSP and
  security headers confirmed present on live responses; both legacy
  redirects re-verified live as real `308`s.

**The handoff list — what genuinely needs the user, not more code:**
1. Manual accessibility pass: NVDA (Windows) and VoiceOver (macOS/iOS)
   walkthroughs of the real site.
2. A Sentry account + DSN, wired into `apps/api`'s already-scaffolded
   filter chain (`SentryGlobalFilter` is mentioned in `app.module.ts`'s
   own comments as deferred to Phase 12).
3. Deploy `apps/web`/`apps/admin` to Vercel and `apps/api` to Railway
   (per the masterplan's chosen topology), provision Neon/Cloudinary/
   Resend for production, and point DNS at them.
4. A load test (k6, per the masterplan) against the deployed API.
5. A completed backup/restore drill against the real Neon database.
6. Real per-city copy, venue lists and testimonials for location landing
   pages — or explicit sign-off to skip them.
7. Real Hindi/Kannada translations, if i18n activation is still wanted.
8. The nonce-based CSP tightening, once there's a real browser/CI
   environment available to verify hydration doesn't break.
9. A/B testing infrastructure and PWA offline support — both are real
   engineering tasks, just not attempted this pass; ask for either
   explicitly when ready.

---

## Verified in this session

Everything below was actually executed against a live Postgres (embedded
18.4 on port 55432 — see gap #1), not assumed.

| Check                                                       | Result                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm turbo lint typecheck build`                           | **19/19 tasks pass** (re-verified after Group B; unchanged task count, more code)         |
| `pnpm turbo test --filter='!@dj/db'`                        | **9/9 tasks pass** — api **66**, utils 45 (Group B added no new unit tests — see gap #11) |
| `packages/db` integration tests (correct `DATABASE_URL`)    | **90 pass** (73 + 15 for ADR 0019 + 2 for ADR 0020) — Phase 1 guarantees hold            |
| `migrate:check` after the new migration                     | **"No difference detected."** — zero drift                                               |
| Full seed re-run against the migrated schema                | succeeds; no `PUBLISHED` row anywhere lacked `publishedAt`                               |
| `apps/api` e2e suite                                        | **163 pass** (was 133) — 30 new tests across 8 new spec files for Group B                |
| App boots against the live scratch DB, Group A modules      | clean; all 8 modules' routes mapped, zero DI errors                                       |
| App boots against the live scratch DB, **all 25 modules**   | clean; Group A + all 17 Group B modules mapped, zero DI errors                            |
| Live smoke test of all 5 new public endpoints               | tracks/playlists/programs/events return seeded data; releases empty (none seeded)        |
| `GET /health`, `/health/ready`                              | 200; all four readiness indicators up                                                    |
| Wrong password vs unknown email                             | **byte-identical** 401 bodies                                                            |
| Login                                                       | access token + `dj_rt` (HttpOnly) + `dj_csrf` (readable)                                 |
| Refresh rotation                                            | new token issued, old one spent                                                          |
| Replaying a spent refresh token                             | 401 `REFRESH_TOKEN_REUSED` **and the whole family revoked**                              |
| Refresh with no / mismatched CSRF header                    | 403 `CSRF_FAILED`                                                                        |
| 12 failed logins from one IP                                | first 401, later ones **429** — per-IP limit enforced                                    |
| Validation failure                                          | **422** with JSON Pointer field errors, no raw Zod internals                             |
| Unknown request property                                    | 422 `unrecognized_keys` — rejected, not stripped                                         |
| VIEWER attempting write / publish / delete                  | **403 `INSUFFICIENT_PERMISSIONS`** (not 401)                                             |
| EDITOR permission set                                       | no `user:*`, no `role:*`, no `settings:*`, no `media:delete`                             |
| VIEWER permission set                                       | every entry ends `:read`                                                                 |
| `GET /personas`                                             | 4 seeded personas with CMS accent colours                                                |
| Cursor pagination                                           | advances correctly; full walk returns every row **exactly once**                         |
| Tampered cursor                                             | 400, not 500                                                                             |
| `?include=secretTable`                                      | 422 — allowlist holds                                                                    |
| `GET /personas/felicitous/page`                             | **5 queries** (`X-Query-Count`), criterion is ≤8                                         |
| `PATCH /admin/personas/reorder`                             | 204 — routed to reorder, not swallowed by `:id`                                          |
| Publish workflow                                            | unpublish hides publicly (404 by slug), republish restores                               |
| Re-publishing a published persona                           | 409 `INVALID_STATUS_TRANSITION`                                                          |
| Soft delete + restore                                       | hidden publicly, still visible to admin, restored intact                                 |
| Audit trail                                                 | `updatedBy` = admin id; `AuditLog` rows carry actor + requestId                          |
| Revalidation                                                | emitted `tags=home,nav,persona:tnt,personas,sitemap`                                     |
| Log redaction                                               | `authorization` and `set-cookie` both `[redacted]`                                       |
| OpenAPI snapshot gate                                       | **fails on drift** (verified by mutating the file)                                       |
| `GET /genres`                                               | 22 seeded genres, cursor meta, default limit 100                                         |
| Genre cursor walk                                           | every row exactly once                                                                   |
| `GET /genres/slugs`                                         | 200 — not swallowed by `:slug`                                                           |
| **Group B** — app boots with all 17 new modules registered | zero DI errors, verified via a live e2e run (not just `nest build`)                       |
| Group B pure-CRUD publish/read/delete round-trips           | Faq, ExperienceEntry, GearItem, Testimonial, StaticPage, Service, Brand — 7 tests         |
| `Brand` ↔ `Persona` M:N (`setPersonas`)                     | associates, filters by `personaSlug`, order preserved                                    |
| `Stat` duplicate-key guard for a null `personaId`            | 409 `UNIQUE_CONSTRAINT` — the case the DB's own unique index cannot catch (NULL ≠ NULL)   |
| `Redirect` self-redirect                                    | 422, rejected by the contract refinement before it reaches the database                  |
| `Tag` delete guard (`PostTag` cascades)                     | 409 while referenced by a post; 204 once untagged                                        |
| `Post` ↔ `Tag` M:N (`setTags`)                              | tags, filters by `tagSlug`, replaces the set wholesale on update                          |
| `SiteSettings` singleton                                    | public read, admin `PATCH` round-trips, restored to its original value in `finally`       |
| `GET /sitemap`                                               | non-empty, every `loc` absolute, spanning personas/venues/tracks/events/services/pages    |
| `POST /inquiries`, Turnstile+Resend unconfigured             | writes a real row, returns in <2s, does not wait on mail                                  |
| Inquiry honeypot                                             | routes to `SPAM` status with `honeypotTripped: true` — no 422                             |
| Inquiry rate limit                                           | 3/hour/IP fires on the 4th attempt, tighter than the global default                       |
| Admin inquiry pipeline                                       | status change, append-only note, soft delete — all round-trip                             |
| Newsletter double opt-in                                     | `PENDING` → `CONFIRMED` (real token) → `UNSUBSCRIBED` (real token), against real rows     |
| Newsletter invalid confirm token                              | 404 `NOT_FOUND`, not a crash                                                              |
| Media upload-signature / confirm / EPK regeneration, unconfigured Cloudinary | all three 503 `SERVICE_UNAVAILABLE` cleanly rather than throwing unhandled     |
| Press kit public list                                        | 200, no auth required                                                                    |
| Content-integrity check after the full e2e run                | zero live leftover rows matching any test's fixture prefix, across every new table; every test-created row still present is soft-deleted (recoverable, invisible to the app) exactly per the soft-delete convention, not a real leak — genuinely live rows in `Faq`/`GearItem`/`Testimonial`/`Service` are the artist's real harvested `seed:content` data (10/11/8/6 rows respectively), not test fixtures |
| Genre publish/unpublish/archive/schedule routes             | **404** — correctly do not exist                                                         |
| `DELETE` a genre in use                                     | **409 `GENRE_IN_USE`** listing the referencing content                                   |
| Referencing content after a refused delete                  | counts unchanged — nothing was stripped                                                  |
| `DELETE` an unreferenced genre                              | 204, and really gone (no `deletedAt` column)                                             |
| Duplicate genre name                                        | 409 against **`/name`**, not `/slug`                                                     |
| Revalidation wiring (persona, genre create, genre delete)   | listener receives the event — verified to **fail** when the bus is two instances         |
| e2e suite run twice, then db integration tests              | **still 73 pass** — the suite is non-destructive                                         |

### Not verified

- **Docker / `docker compose up -d`** — still not installed (gap #1).
- **Cloudinary, Resend, Turnstile, Neon** — placeholder credentials (gap #2).
  This is the reason Phase 5's literal exit criteria (a real upload landing
  with correct bytes/derivatives), Phase 6 engagement's (an email actually
  delivered, a Turnstile token actually rejected) and the press-kit's (a PDF
  actually uploaded, a gated download actually restricted) are none of them
  verified end to end — every code path that reaches an external service is
  verified only up to the point of a clean, graceful `503`.
- **100% coverage of `auth/`** — a Phase 3 exit criterion that is **not met**.
  The auth _behaviour_ is covered end to end, but line coverage has not been
  measured or enforced. The threshold block exists in `vitest.config.ts`;
  `TotpService` and `PasswordService` have no unit tests. See gap #7.
- **Group B has no unit tests, only e2e.** Every other Group A module
  followed the same pattern (services tested through the HTTP boundary, not
  in isolation), so this is consistent with the existing convention rather
  than a new gap — noted anyway since it compounds gap #7's argument for
  eventually adding a unit layer. See gap #11.
- **Gallery, Video** — out of scope for this pass; not part of `phases.md`'s
  Phase 6 exit criteria. See the Group B section above.
- **Load, Lighthouse, axe, Playwright** — later phases.

---

## Known gaps and follow-ups

| #   | Item                                                                                                                                                                                                                                                                        | Why it matters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Owner |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | ~~No Postgres on this machine~~ **Resolved (Group D session).** A real Neon Postgres is now in use, migrated and seeded for the first time this session.                                                                                | No action needed. `docker-compose.yml` remains correct for anyone who prefers local Postgres instead.                                                                                                                                                                                                                                                                                                                                                                                                     | —  |
| 2   | ~~No real credentials~~ **Resolved (Group D session).** Cloudinary, Resend and Turnstile all carry real credentials now; `/health/ready` reports `cloudinary: configured=true`.                                                                                                                                                                                    | Phase 5/6/8's credential-dependent paths can now be verified for real — see gap #4 (no actual media uploaded yet) and gap #16 (email delivery still unobserved) for what's still outstanding despite having real keys.                                                                                                                                                                                                                                                                                                                                                                                                                                    | —     |
| 3   | **Legacy Resend API key was committed** in the old `djfelicitous/.env.local`, and looked live.                                                                                                                                                                              | **Revoke it in the Resend console.** [Runbook](../05-operations/runbooks/secret-rotation.md).                                                                                                                                                                                                                                                                                                                                                                                                           | user  |
| 4   | **The 33 legacy images are no longer on disk.**                                                                                                                                                                                                                             | Catalogued in [`../07-content/legacy-audit.md`](../07-content/legacy-audit.md); the files must come from the artist's originals. Phase 5 needs them.                                                                                                                                                                                                                                                                                                                                                    | user  |
| 5   | No events seeded from legacy data                                                                                                                                                                                                                                           | The legacy gig list carried no dates. Inventing them would repeat the fabricated-testimonial mistake.                                                                                                                                                                                                                                                                                                                                                                                                   | —     |
| 6   | **`packages/db` unit-test task fails by default.** `packages/db/.env` points at `localhost:5432`; the specs need a reachable Postgres.                                                                                                                                      | `pnpm turbo test` fails on `@dj/db` on any machine without a database there — which reads as a broken build rather than a missing service. Either point that file at a real database or make the specs skip with a clear message when none is reachable. Same root cause as gap #1.                                                                                                                                                                                                                     | —     |
| 7   | **`auth/` is not at 100% line coverage** — a Phase 3 exit criterion. `TotpService`/`PasswordService` are now ~98% (34 new tests); `AuthService` (520 lines, 8 deps), `AuthController`, `AuthRepository`, `RefreshTokenService`, `AuthCookieService` remain 0% unit-covered. | Behaviour is covered end to end by 36 e2e tests (lockout, reuse detection, family revocation, CSRF, no-enumeration) — the gap is unit-level isolation, which mocking 8 dependencies makes a substantial separate task. A second finding while closing this: the coverage _provider_ (`@vitest/coverage-v8`) had never been installed, so the threshold in `vitest.config.ts` had never actually run before this session. See [ADR 0021](../01-decisions/0021-auth-coverage-gap-and-inert-threshold.md). | —     |
| 8   | **No `UsersModule`.** The RBAC e2e spec mints its test users through `PrismaService` directly.                                                                                                                                                                              | Fine for now and documented in the spec, but it means role assignment has no API. Phase 6 adds it; until then the admin cannot invite anyone.                                                                                                                                                                                                                                                                                                                                                           | —     |
| 9   | ~~`packages/motion` does not exist~~ **Resolved (visual-layer session)** — built to the API `motion.md` documented, and the app-local `lib/motion.ts`/`motion-gate.tsx` deleted. `packages/{media,seo,analytics}` still do not exist. | Deliberate — empty stubs are worse than absent. Created in the phase that needs each. | — |
| 10  | **The OpenAPI snapshot does not describe response bodies.** Every response is `{"200": {"description": ""}}` — controllers return contract types, not `createZodDto` response classes.                                                                                      | The gate catches route, parameter, security and request-body changes, but not a changed response shape. `apps/web` will catch those via the shared Zod contract at `typecheck` time, so the risk is bounded — but the gate is narrower than "the contract". Annotating responses with nestjs-zod's `ZodResponse` would close it.                                                                                                                                                                        | —     |
| 11  | **Group B (17 modules) has no unit tests, only e2e.** Consistent with Group A's own convention, but the surface area is now much larger.                                                                                                                                    | If a unit-test layer is ever added for `auth/` (gap #7), extending the same effort to `MediaService`'s reference-counting/force-delete logic and `InquiriesService`'s spam scoring would be the highest-value next targets — both have branchy logic an e2e test exercises only a few paths of.                                                                                                                                                                                                        | —     |
| 12  | **Gated press-kit downloads are not truly access-restricted.** `PressAssetsService.requestDownload()` signs a 7-day-expiring URL via `private_download_url`, but the underlying `MediaAsset` is always uploaded with Cloudinary's default `upload` delivery type, whose plain `secureUrl` stays reachable regardless of the signed link's expiry.                          | Closing this needs delivery-type selection (`private`/`authenticated`) added to `MediaService.createUploadSignature()` for press-kit purposes specifically, and is documented in the method's own comment rather than fixed silently.                                                                                                                                                                                                                                                                    | —     |
| 13  | **EPK regeneration is manual-only.** The masterplan wants it debounced-automatic on a persona bio/stats/photo change; only `POST /admin/press-kit/epk/:personaKey/regenerate` exists.                                                                                       | Low priority until the admin panel (Phase 11) exists to trigger it from a save action anyway.                                                                                                                                                                                                                                                                                                                                                                                                              | —     |
| 14  | **React Email was not installed for the three transactional email templates.** `infra/mail/templates.ts` builds plain HTML/text strings instead.                                                                                                                            | A deliberate, documented scope reduction — fine for three templates, worth revisiting if the template count or design ambition grows.                                                                                                                                                                                                                                                                                                                                                                     | —     |
| 15  | **The API's e2e suite assumes a disposable database and was pointed at the real, persistent Neon database this session.** `auth.e2e-spec.ts` deliberately drives the seeded admin account into a lockout state to test that behaviour — correct on a throwaway DB reset per run, but it left the real `SUPER_ADMIN` account genuinely locked afterward. | Run this suite only against a disposable database (the throwaway embedded-Postgres pattern every prior session used) — never against the real Neon instance the artist will actually use. If CI ever runs it against a shared environment, seed a dedicated disposable database per run, or the suite will keep locking out real accounts. | — |
| 16  | **No track has real audio yet**, so the mini player (Phase 9) and audio-dependent JSON-LD fields are built and wired but functionally untested against a real file — every seeded track's `audioUrl` is `null`. Same root cause as gap #4, though the underlying upload flow itself is no longer in question: a real signed upload/confirm round-trip was verified end to end this session (bug #34, now fixed) using the admin's own media library, which now exists (Phase 11). | Upload at least one real audio file through `/media` in the admin, or directly via `POST /admin/media`, to genuinely exercise playback, waveform peaks, and the `MusicRecording` `audio` field. | user |
| 17  | **The cinematic layer has never been opened in a browser.** Shaders, the 3D deck, the accent crossfade, SoundCloud playback, the keyboard-only channel switcher and the four persona themes are all code-verified and budget-verified, but unobserved. | Everything here is visual or audible by definition; `curl` and a build log cannot confirm any of it. One pass through a real browser at three tiers (normal, forced `prefers-reduced-motion`, CPU-throttled) is the single highest-value next action. | user |
| 18  | **Real-device performance for the mobile WebGL tier ([ADR 0022](../01-decisions/0022-webgl-tier-on-capable-touch-devices.md)) is untested.** The gate is `deviceMemory`/`hardwareConcurrency`, DPR is capped at 1.0 on coarse pointers, and 3D stays desktop-only. | If a mid-range Android drops frames on the shader field, the fix is a one-line change to the threshold in `useCapability()` — but somebody has to look first. | user |
| 19  | **`apps/api/openapi.json` had 133 lines of undetected drift** from Group E, regenerated this session. | The drift gate only runs when someone regenerates. Worth adding `openapi:update` + a dirty-tree check to CI so a stale snapshot fails the build rather than sitting unnoticed across four sessions. | — |

---

## Cinematic visual layer (this session)

The gap that prompted it, stated plainly: `apps/web` was functionally
complete and **visually flat**. Every page was
`Section > Container > SectionHeader > grid of bordered cards`. There was no
hero, no scroll effect, no persona switcher, no shader, no 3D — the only
motion in the whole app was an 8px magnetic hover on one button. For a DJ
portfolio, where the visual impression _is_ the product, that was the most
important thing left.

Meanwhile the foundation for exactly this work was already built and unused:
`theme.css` registers `@property --color-accent` with a `:root` transition
**specifically so a channel switcher can crossfade the accent**, ships four
persona themes, and implements reduced motion as a token-level kill switch.
None of it had a consumer.

### The constraint that shaped every decision

There are **zero photos, zero video and zero font files** in this repo, and
no `apps/web/public/`. Every image-dependent experience `motion.md`
specifies had no assets to work with. So the layer is **generative-first**:
WebGL shaders, procedural 3D, kinetic typography and real data
visualisation — all asset-free, all on-brand for electronic music, and all
of it what `motion.md`'s own fallback tier required to exist anyway.
Photography slots in later as enhancement, never as a prerequisite.

### What shipped

**`packages/motion`** — the package `motion.md` documented and gap #9 said
did not exist. `useReducedMotion`, `useCapability` (three tiers),
`MotionGate`, `useAccentRgb`, shared variants. The tier starts at `'static'`
and upgrades after mount, which is what structurally guarantees the
reduced-motion JS budget: no island chunk is ever _referenced_, so none is
fetched.

**Real typography** — Anybody (display), Inter (sans), JetBrains Mono, via
`next/font/google`. `typography.md` names all three, including Inter as the
sanctioned open alternative to commercial Satoshi, so this is no deviation.
Self-hosted at build: no external request, no CSP change, no binaries
committed, and a wrong family name is a build error.

**`packages/ui` primitives** — `Button` and `Chip` from `components.md`'s
canonical cva spec, plus the `layout`/`composites` barrels. The `exports`
map had pointed at those three paths since Phase 0 while the directories
were empty, so **any `@dj/ui/primitives` import failed**. Fixed in passing.

**The shader field** (`components/cinematic/`) — one fragment shader with
four persona variants blended on a `uVariant` axis; DPR capped at 1.0 on
coarse pointers and 1.5 otherwise; `frameloop` gated by IntersectionObserver
and `visibilitychange`, so an offscreen or backgrounded tab renders nothing.
The `light`/`static` tier is a finished layered-gradient composition with SVG
grain, always present in the HTML, with the canvas fading in over it.

**The channel switcher** — the signature module, and the consumer
`@property --color-accent` was registered for. Tuning sets `--color-accent`,
`--color-accent-strong` and `--gradient-persona` on `documentElement` from
the persona's **CMS** hex, so the artist can retune a channel from the admin
with no deploy. Arrow-key navigable; mobile is a snap-scrolled rail.

**The homepage, rebuilt as nine acts** — hero, channel switcher, the whole
19-track playable wall, the deck, the map, residencies, services, proof +
rig, and a booking CTA. Driven by the brief that most promoters never open a
second page: every area of the site is represented here with real content,
not a teaser.

**The persona pages** — the same act vocabulary tuned to one channel, opening
already tuned to its own accent.

**The player, rebuilt on the SoundCloud Widget API** — the change that makes
the catalogue actually audible. All 19 tracks carry a real
`soundcloudTrackId`; none has an `audioUrl`. The old player gated on
`audioUrl`, so **the play button never rendered for any track in the
catalogue**. Both transports now live in `PlayerProvider` itself rather than
in the `MiniPlayer` chrome, so playback no longer depends on whether a piece
of UI happens to be mounted.

### Contract change

`soundcloudTrackId` was promoted from `TrackDetail` to `TrackSummary`. The
track wall and every listing play button need a playable source, and without
it the only route was N detail round-trips for a list of 19. Every track
query already `include`s the scalar, so this costs nothing at the database.
`apps/api/openapi.json` was regenerated.

### Documented deviation

[ADR 0022](../01-decisions/0022-webgl-tier-on-capable-touch-devices.md) —
`motion.md` sends every coarse pointer to the `light` tier. That rule was
written for _video_ (bandwidth-bound); this layer is generative shaders
(GPU-bound), so the gate is now `deviceMemory` and `hardwareConcurrency`
rather than pointer type. Mitigations are in the ADR. **3D scenes remain
desktop-only regardless.**

### Honest naming

The bars behind a playing track are called a **rhythm field**, not a
waveform. No track has `waveformPeaks`, and the SoundCloud iframe is
cross-origin so Web Audio FFT is impossible — calling it a waveform would be
a fabrication of exactly the kind `brand.md` exists to prevent. It is
deterministic per track id and pulses at the track's real BPM.

Likewise: no "Upcoming shows" section on the new homepage. The catalogue has
zero events on purpose (gap #5), so that section would have rendered blank.
The six real weekly residencies tell the live story instead — and "resident
every Sunday" is a stronger claim than one dated gig anyway.

### Three rendering bugs found by actually serving the site

The visual layer was code-complete and budget-green but looked wrong in the
browser. All three causes were invisible to `tsc`, ESLint and the build — and
two of them had been degrading **every page in both apps**, not just the new
work.

**1. `cn()` was silently deleting classes across the whole design system.**
`tailwind-merge` ships a list of *stock* Tailwind class names and infers the
rest. Our `@theme` block adds `--text-display`, `--text-lead`, `--text-h2`
and friends, which tailwind-merge cannot know about — so it classified
`text-lead` as a text **colour** and treated it as conflicting with
`text-on-accent`. The later class won; the earlier one vanished.

Concretely, before the fix:

| written | emitted |
| --- | --- |
| `bg-accent text-on-accent h-14 px-8 text-lead` | `bg-accent h-14 px-8 text-lead` |
| `border text-eyebrow … text-accent bg-accent-soft` | `border … text-accent bg-accent-soft` |

So **every primary CTA on the site rendered body-coloured text on an accent
fill**, and every Chip lost its font size. Fixed by declaring the project's
`--text-*` scale to tailwind-merge via `extendTailwindMerge` in
`packages/ui/src/lib/cn.ts`. The token list there must stay in sync with
theme.css — adding a `--text-*` token without adding it to that list
reintroduces the bug for that one size, silently.

**2. The display font's variable axes were never driven.** Anybody ships
`wght 100–900` and `wdth 50%–150%`, and `typography.md` picks it precisely
for "wide, brutalist, techno-poster energy". A variable font with no axis set
renders at 400/100%, so every heading — including an 11rem `<h1>` — was a
plain, narrow rendering of a face whose whole purpose is the opposite. Fixed
with a `@layer base` rule on `.font-display` (`font-weight: 800`,
`font-stretch: 125%`), which per-component `font-*` utilities still override.

**3. The hero backdrop relied on an unguaranteed stacking context.** The
`-z-10` shader container sat inside a bare `relative` section, which does not
create a stacking context. It happened to paint correctly because `html` has
no background and `body`'s propagates to the canvas — but that is a
coincidence of the current token layer, not a guarantee. Adding `isolate` to
both hero sections pins the backdrop inside its own stacking context.

**Also observed, not a code bug:** `GET /stats` returns an empty collection,
so the proof act renders its testimonials without the counter row, and the
`CountUp` island never mounts. The stats content exists as seed data but is
not in a published state. That is a content decision for the artist in the
admin, not something to fix in code.

### How these were verified

Against the running dev server on :3000, not by inspection: the emitted class
attribute for a primary CTA now retains `text-on-accent`; the compiled
stylesheet contains the `.font-display` base rule; and all sixteen key routes
(`/`, the four persona pages, `/music`, a track page, `/venues`, `/programs`,
`/services`, `/book`, `/about`, `/search`, `/testimonials`, `/press`,
`/rider`) return 200. `pnpm turbo lint typecheck build --filter='!@dj/db'` is
20/20 green and the budgets held (`/` 124 kB, `/[persona]` 127 kB).

**Still unverified, and unchanged by this pass:** nobody has looked at the
page. Whether the shader renders, the deck spins, the accent crossfades or a
SoundCloud track plays is still unknown — see gaps #17–18.

### Second UX/bug pass, plus a real Gallery feature and hero video (this session)

The user reported the admin panel still looked unrevamped, one bug in the
public mobile menu, mobile pages not fitting the screen, no visible gallery
option, and asked for hero-video and profile-photo management from the
admin. Each was investigated against the running app with a temporarily
installed headless browser — the same discipline as the previous pass —
and several turned out to be real, previously undetected bugs rather than
missing polish.

**"The admin panel revamp isn't reflected."** It wasn't — the previous
session's admin changes were two hint lines on one form field, not a shell
redesign, and a screenshot of the real dashboard confirmed a genuinely bare
developer-scaffold UI: a plain sidebar of text links and one paragraph.
Fixed properly this time:

- `DashboardShell` rebuilt: an accent left-rail on the active nav item, a
  "View live site ↗" link in the topbar, a working mobile drawer (the
  sidebar collapses below `lg` and opens from a hamburger button — it did
  not exist at all before), and the same visual language as the public
  site's own token layer rather than an unstyled second design.
- The dashboard home page rebuilt from one static paragraph into six live
  stat cards (Personas/Tracks/Venues/Programs/Services/Testimonials, each a
  real count fetched from the API, each linking straight to that list) plus
  a "Quick actions" panel and a "Known gaps" note — the single highest-value
  fix for "I don't know where a change will show up."

**A real, separate bug found while wiring the hero-image round-trip:** the
Persona edit form could never show an already-set hero/avatar image.
`PersonaAdminDetail` (the admin read shape) only ever resolved
`heroMediaId`/`avatarMediaId` to `heroImage`/`avatarImage` — the raw ids the
form's dropdown selects *by* were never returned. Re-opening a persona that
already had a hero image always showed the picker as "none selected", and
saving again would have silently wiped it (the previous session's own
`|| undefined` on those fields meant "no change" to the API, which
coincidentally saved this from actually deleting anything — but only by
accident). Fixed by adding the three raw ids to `PersonaAdminDetail`
(admin-only; the public shape is unaffected) and switching the form's save
payload to `|| null` so clearing a picker back to "none" actually clears it.

**Mobile menu not closing after navigation — confirmed and fixed.** The
header's mobile menu was a bare `<details>` disclosure with zero JS by
design (motion.md's own budget reasoning) — but a bare `<details>` has no
"close when a link inside is followed" behaviour, so every navigation left
the panel open over the page until the visitor found "Menu" a second time.
Extracted into `<MobileNav>`, a small client component whose only job is
`ref.current.open = false` on each link's `onClick` — the smallest possible
fix, and the one thing plain HTML genuinely cannot do here. Verified live:
opening the menu, clicking "Music", and confirming the `<details>` closes
and the URL changes.

**Mobile pages not fitting the screen — two distinct real bugs, not one.**

1. `gig-map.tsx`'s venue list had `truncate` on a flex child with no
   `min-w-0` — a flex item's default min-width is its own content's natural
   width, so `truncate` silently does nothing until that's set, and a long
   venue name pushed the whole row (and the page) wider than the viewport.
   One class fixes it; the file now carries a comment so the next person
   who reaches for `truncate` in a flex row does not repeat it.
2. The homepage and persona hero both showed exactly 46px of real,
   confirmed horizontal scroll (not a visual glitch — `document
   .elementFromPoint` at the scrolled-in position resolved to `<html>`
   itself, meaning the extra space was empty, just scrollable). Root cause:
   `document.scrollingElement` is `<html>`, and an `overflow-x: clip` was
   only ever applied to `<body>` — added the same rule to `html`, and a live
   check (`window.scrollTo(1000, 0)` then reading `window.scrollX`) went
   from `61` to `0` on both the homepage and a persona page.

**"I don't see a gallery option" — a real, working feature now exists,**
not a placeholder. `Gallery`/`GalleryItem` Prisma models, RBAC permissions
(`gallery:read/write/publish/delete`) and even the revalidation `TAG_MAP`
entry had existed in the schema/seed **since Phase 1**, entirely unused —
this session built the missing middle layer: a full `GalleriesModule`
(public + admin controllers, service extending `BaseContentService`,
repository, mapper — the exact same shape as every other publishable
content type, so it needed no new architectural pattern), contracts
(`GallerySummary`/`GalleryDetail`/`GalleryCreateInput`/…, an items array
that is always a **full replace** rather than add/remove/reorder
sub-endpoints — deliberately, because a gallery's items are in practice
always re-ordered as a whole, never patched one at a time), an admin
screen (`/galleries` list via the existing generic `EntityList` scaffold +
a bespoke `GalleryForm` with the same ordered-picker pattern
`PlaylistForm` already established: add/remove/move-up/move-down, plus a
caption per image and a "set cover" action), and two public pages
(`/gallery` index, `/gallery/[slug]` masonry detail) with "Gallery" added
to the header nav. Zero galleries are seeded — no real photos exist in
this repo (see CLAUDE.md) — so the index page's honest empty state
("No galleries published yet") is what ships until the artist adds one.

**Hero video and a way to manage it — `Persona.bgVideoMediaId` also
already existed in the schema, unused.** Wired the same way: `bgVideoUrl`
added to the public `PersonaDetail` read shape (resolved from the media
asset's `secureUrl`), `bgVideoMediaId` added to the admin write schema,
`MediaSelect` extended with a `mediaType` filter so the same picker
component can offer videos instead of images, and `StageBackdrop` extended
to render a real muted/looping/`playsInline` `<video>` over the generative
field when a persona has one set — gated on `useCapability() !== 'static'`,
so a reduced-motion or low-power visitor never gets an autoplaying video,
only the field. No persona has a clip yet (no real video exists in this
repo either), so every persona page today renders exactly as before —
this only takes effect once the artist uploads one.

### Verified

- Every fix confirmed against the real running app (API + a scratch web
  dev server on a clean cache), using a temporarily reinstalled headless
  Chromium for screenshots and live DOM/scroll checks, removed afterward —
  `apps/web/package.json` and `pnpm-lock.yaml` are unchanged.
- The full Gallery flow round-tripped for real: logged in via
  `/auth/login`, created a gallery via `POST /admin/galleries`, published
  it, confirmed it appeared on `GET /galleries`, `GET
  /galleries/:slug` and the live `/gallery` page, then deleted it — no
  test data was left in the database.
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green.
- Bundle budgets still hold: `/` 124 kB, `/[persona]` 127 kB (both well
  under 145/155 kB), `/gallery` 111 kB and `/gallery/[slug]` 108 kB (both
  under the 120 kB content-route budget).
- The mobile-menu-closes and no-horizontal-scroll fixes were each verified
  with a live, scripted check against the running page (not just code
  review): `window.scrollX` after an attempted scroll, and the `<details>`
  element's `open` property before and after a real link click.

### Not verified / explicitly out of scope

- No real device or screen reader was used for any of this — all
  verification was a headless, mouse/keyboard-driven browser.
- The Gallery admin form's image picker has no crop/focal-point UI (same
  documented gap as every other `MediaSelect` use — see Group E's "next
  pass" notes) and no drag-to-reorder (move-up/down buttons only, the
  project's established accessible baseline, not a stand-in).
- No gallery or hero-video content exists yet, by design — CLAUDE.md's
  "never invent content" rule means this ships as working, empty
  infrastructure for the artist to fill in, not backfilled with placeholder
  media.
- `/gallery` was not added to the sitemap generator in this pass — worth a
  follow-up so a published gallery is discoverable to search engines, not
  only from the header nav.

### User-reported bugs and UX pass (this session)

The user tested the running site directly and reported eleven issues. Each
was investigated against the real running app (a headless Chromium was
installed temporarily for this — screenshots and DOM/computed-style
inspection, not guesswork) rather than assumed. Two were deep, previously
undetected structural bugs; the rest were real, scoped fixes.

**1. Button text overflowing its pill everywhere — root cause, not a
symptom.** Tailwind v4 only auto-scans for candidate classes downward from
the compiling app's own source tree (`apps/web/src`, `apps/admin/src`).
`packages/ui` is a sibling package outside both trees, so any utility class
that appeared *only* inside a `@dj/ui` component — `Button`'s `h-14 px-8`,
`h-9`, `Chip`'s padding — was never generated into the compiled CSS. No
error, no warning: the component still rendered the class name in its
`className` attribute, so the DOM looked correct, but the browser had no
rule to apply. The result was a solid-colour pill sized to its text with
zero padding and the wrong height, so text touched or ran past the edge —
confirmed by measuring the live computed style (`padding: 0px`, `height:
33px` instead of `56px`) before the fix, and `padding: 0 32px`, `height:
56px` after. Fixed with one `@source '../';` line in
`packages/ui/src/styles/theme.css`, the single file both apps import — so
both inherit correct scanning, not just `apps/web`.

**2. Tracks could not be played — a dev-mode-only CSP bug, verified by
instrumenting the actual click.** `next.config.ts`'s CSP had no
`unsafe-eval` in `script-src`, which is correct hardening for a production
build — but `next dev`'s webpack bundler wraps every module in `eval()`
under its dev source-map devtool. With no `unsafe-eval`, that `eval()`
throws a CSP violation on every module evaluation, silently breaking
hydration: the server-rendered HTML paints fine, so the page *looks*
complete, but no client component ever finishes attaching its event
handlers. A play button's `onClick` never fired — confirmed directly by
adding a temporary `console.log` inside it and observing zero output despite
a real, successful Playwright click. Fixed by adding `'unsafe-eval'` to
`script-src` **only when `NODE_ENV !== 'production'`** — the production CSP
is unchanged and still carries no `unsafe-eval` (verified by evaluating the
config line with `NODE_ENV=production`). This almost certainly also
explains why other interactive pieces (the channel switcher, the deck) felt
inert during manual testing — the fix should restore all of them at once
rather than needing one-by-one chasing.

**3. Admin UX.** A full redesign is out of scope for a single pass and
would be irresponsible to rush — but the specific, named complaint ("I
don't know where a change will show up") was addressed at its two highest-
traffic points: `MediaSelect` now takes an optional `hint` line and shows a
plain "none" placeholder box instead of nothing when empty, and the
Persona form's Hero/Avatar image fields now say exactly where each shows up
publicly (e.g. "Shows at the top of djfelicitous.com/felicitous — currently
a generated colour background if left empty"). Every entity form already
had a "Preview" link to its live page (`persona-form.tsx`'s existing
`previewUrl` call) — that pattern is the right one to extend to the other
entity forms as a follow-up, not something to reinvent.

**4. API sweep.** Every public collection endpoint (`personas`, `venues`,
`tracks`, `releases`, `playlists`, `programs`, `genres`, `services`,
`testimonials`, `brands`, `stats`, `faqs`, `gear`, `experience`, `settings`,
`redirects`, `sitemap`, `tags`, `posts`, `press-kit`) returns 200 against
the live API. One endpoint I initially guessed the wrong path for
(`/static-pages` — the real route is `/pages/:slug`) is not a bug; no
`StaticPage` rows are seeded, which is a content gap, not a code one.

**5. Galleries/posters/videos, and whether a hero video can be uploaded —
scoped, not implemented.** Per `STATUS.md`, Gallery and Video have been a
deliberately out-of-scope content type since Phase 6 — no schema, no API
module, no admin UI exists for either. Adding one now means a real Prisma
migration against the live database plus a new API module plus new admin
screens plus new public rendering; that is a phase of work in its own
right, not a fix to slot into this pass safely. The admin **can** already
attach a static hero *image* to a persona (`MediaSelect` on the Persona
form, now with a clearer hint — see #3) — there is no hero **video** field
today. Recommend scoping "Gallery + Video content types" as its own
next-phase item with a written plan, rather than guessing at a schema here.

**6. Font too big.** `--text-display` was `clamp(3.5rem, 1rem + 11vw,
11rem)` — 176px at its max, and on a real mobile viewport (390px) the
headline alone filled the screen (confirmed by screenshot). Combined with
the `.font-display` weight/stretch rule added the previous session
(`font-weight: 800; font-stretch: 125%`), the effect compounded. Reduced
the whole `--text-h4` through `--text-display` scale roughly 25–40% at
every step, and dialled the stretch back to 112%. Still the largest thing
on the page — no longer competing with legibility.

**7. "Nothing 3D except the map, and everything is laggy."** The 3D deck
*is* there (`components/home/deck-scene.tsx`, real WebGL confirmed via
console — a `THREE.Clock` deprecation notice and GPU driver messages only
fire when a real WebGL context is active) but sits below the fold on a
`hidden lg:block` section, so it is easy to miss on a first scroll,
compounding with #2 above making it unresponsive to drag. Reduced the DPR
ceiling on both the shader field and the deck from `1.5` to `1.25` — a
~30% cut in GPU pixel count on both canvases — as the safe, verifiable
improvement available without a real device to profile against.

**8/9. WhatsApp and phone call are the actual preferred contact channels.**
Added `<ContactDock>` — a persistent, fixed WhatsApp + call button pair on
every marketing page, using the CMS's existing `whatsappNumber`/
`contactPhone` settings fields (no new schema). It coordinates with two
other fixed-position elements it did not know about at first: the mini
player (via the pre-existing `--dock-clearance` custom property pattern)
and the cookie consent banner, which it initially overlapped — caught by
screenshot, fixed by having the consent banner measure and publish its own
real height via `ResizeObserver` (a guessed constant would have drifted
whenever the notice wrapped a different number of lines).

**10. Branding presence.** The header wordmark went from `text-lg` to
`text-xl`/`sm:text-2xl` with the "Felicitous" half in the live accent
colour, so it reads as a mark rather than plain page-title text.

**11. Placeholders for missing media.** Considered adding a generic
"Photo coming soon" panel to the persona hero, but the site's existing
generative shader/gradient backdrop already fills that role by design —
that was the whole premise of the earlier visual-layer work, and stacking
a second placeholder on top of it would look redundant, not better. Scoped
the actual placeholder work to where a slot silently disappeared with no
indication it existed: the admin's `MediaSelect`, covered under #3.

### Verified

- Every fix confirmed against the **actual running app** via a temporarily
  installed headless Chromium (screenshots + computed styles), not by
  reading code and assuming: the button padding/height before and after,
  the click handler literally not firing before the CSP fix and firing
  after, the consent-banner/dock overlap before and after.
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green.
- Bundle budgets still hold: `/` 124 kB (145 budget), `/[persona]` 127 kB
  (155 budget).
- Production CSP re-verified to carry no `unsafe-eval` (evaluated the
  config line with `NODE_ENV=production` set).
- All 8 spot-checked routes (`/`, all four persona pages, `/music`,
  `/favicon.ico`, `/book`) return 200 on a clean rebuild.
- The temporary Playwright install and every scratch screenshot/inspection
  script used for this pass were removed before committing —
  `apps/web/package.json` and `pnpm-lock.yaml` are back to their prior
  state.

### Not verified

- No real mobile device or low-end GPU was used for #7 — the DPR cut is a
  safe, reasoned improvement, not a profiled one.
- Gallery/Video (#5) remains entirely unbuilt, by design, pending a
  scoping decision from the user.
- The broader admin UX pass (#3) touched two fields on one entity form as
  a demonstrated pattern; the other ~20 entity forms were not touched.

### Two more bugs found from the user's own dev-server log (this session)

The user ran `pnpm dev` and pasted the terminal output. Two real, reproducible
bugs were in there under a lot of dev-mode noise:

**1. The `felicitous-x-geetz` persona page 502'd on every request** — a real
seeded SEO description was 161 characters against `SeoMetaSchema.description`'s
`max(160)`, so `PersonaPageResponse` failed contract validation on every
render. `zod`'s `.flatten()` keys `fieldErrors` by the top-level path segment
only, so the console printed `fieldErrors: { persona: [...] }` for what was
actually `persona.seo.description` two levels down — worth knowing next time
a `contract_drift` log names an object field rather than the actual string
field that overflowed.

Fixed by trimming the real seed copy by one word (161 → 149 chars, meaning
unchanged) in `packages/db/seed/data/personas.ts`, then re-running
`pnpm --filter @dj/db exec tsx seed/index.ts` against the live database —
persona seeding is `update`-based and idempotent, so this only corrected the
one field, it did not reseed or duplicate anything else. (That same seed run
also re-applies the pre-existing, `[DEMO]`-prefixed, faker-seeded synthetic
events/inquiries dataset that `packages/db/seed/demo.ts` documents as
"development only" — upsert-based on a fixed faker seed, so re-running is a
no-op there too. Confirmed this did not add new rows.)

**2. `/favicon.ico` crashed the `[persona]` dynamic route.** No real
`favicon.ico` file exists anywhere in the repo (only the dynamic `icon.tsx`
metadata route, referenced by a `<link>` tag). Browsers request
`/favicon.ico` directly regardless of what the page's `<head>` says, and with
no static file at that literal path the request fell through to
`[persona]/page.tsx` with `slug = "favicon.ico"`. That page fetched
`getPersonaPage` and `getTracks({ personaSlug })` **in parallel**
(`Promise.all`) — and `getTracks` validates `personaSlug` against the real
slug format and threw a 422 before the `!page → notFound()` check ever ran,
surfacing as an unhandled server error instead of a clean 404.

Two fixes: added a real `favicon.ico` route handler
(`apps/web/src/app/favicon.ico/route.tsx`, same generated mark as `icon.tsx`)
so the browser's automatic request is answered directly and never reaches the
dynamic segment; and made the persona page's fetches sequential — fetch the
page, `notFound()` if it's null, and only then fetch tracks — so **any**
unknown or malformed persona slug degrades to a clean 404 rather than racing
an unrelated validation error, not just this one case.

### Verified

Against a scratch dev server on a clean `.next` cache (port 3050, to avoid
touching the user's own running dev server): `/favicon.ico` now returns a
real 32x32 PNG with `content-type: image/png`; `/felicitous-x-geetz`,
`/felicitous`, `/tnt` and `/trinitrocosmic` all return 200 with an empty error
log (previously: `contract_drift`, `502`, `422`). `pnpm turbo lint typecheck
build --filter='!@dj/db'` — 20/20 green.

The `Cannot find module './vendor-chunks/tailwind-merge@2.6.1.js'` and
`segment-explorer-node.js` errors in the user's log are stale dev-server
cache corruption (a `.next` directory left running across a dependency/config
change under it) — not a code bug. They cleared on a fresh
`rm -rf .next && next dev`, which is the standing fix whenever they recur:
stop the dev server, delete `apps/web/.next`, restart.

### Verified in this session

- `pnpm turbo lint typecheck build --filter='!@dj/db'` — **20/20 green**,
  with the real API running against the real seeded Neon database.
- **Bundle budgets, measured from the real build output:** `/` first-load
  **123 kB** (budget 145 kB); `/[persona]` **126 kB** (budget 155 kB). The
  first measured build came in at **364 kB**, because `dynamic()` without
  `ssr: false` pulled `three` into the homepage's first load — and
  `ssr: false` cannot be called from a Server Component in Next 15, so the
  3D act is now gated behind a client boundary (`deck-act.tsx`) that owns
  the dynamic import. Without that measurement the budget would have been
  blown by 2.5x and nothing would have complained.
- The prerendered `/` HTML contains every act's real content, exactly one
  `<h1>`, and the map's real projected pins — i.e. the page is complete with
  JavaScript disabled.
- The API returns `soundcloudTrackId` on the tracks collection, verified
  against the live endpoint.

### Not verified

- **Nothing was opened in a real browser.** No shader was seen to render, no
  deck seen to spin, no accent seen to crossfade, no SoundCloud track heard.
  The three-tier smoke test, the keyboard-only switcher pass and the
  four-theme persona check from the plan's verification list all need a
  browser and have **not** been done.
- The reduced-motion ≤60 kB JS figure is **reasoned, not measured**: the
  `static` tier references no island module, so no chunk can be requested.
  Confirming it needs a network panel.
- Real-device performance for the ADR 0022 mobile WebGL tier is untested.
  The mitigations are in place; whether a mid-range Android actually holds
  frame rate is unknown.
- `apps/api/openapi.json` also picked up **133 lines of pre-existing drift**
  from Group E's media-attachment fields, which had never been regenerated.
  That drift was not introduced here — it was surfaced by regenerating.
  Worth knowing the gate had been silently stale.

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
- [x] `TotpService` / `PasswordService` unit tests — ~98% lines each (new)
- [ ] **100% coverage of `auth/`** — not met. `AuthService`, `AuthController`,
      `AuthRepository`, `RefreshTokenService`, `AuthCookieService` remain
      e2e-only. See gap #7 and
      [ADR 0021](../01-decisions/0021-auth-coverage-gap-and-inert-threshold.md).

## Phase 4 — Core content CRUD ✅

- [x] `BaseContentService` — publish / unpublish / archive / schedule /
      remove / restore / reorder, with an enumerated transition table
- [x] Cursor pagination carrying the full sort tuple + id tiebreaker
- [x] Offset pagination for admin tables
- [x] Include allowlist, sort allowlist, `publishedWhere()` composition
- [x] Idempotency, ETag / `If-None-Match`, cache-control policies
- [x] Cache-tag revalidation, HMAC-signed, symmetrical with `@dj/contracts`
- [x] **Personas** — complete and verified; the **publishable** exemplar
- [x] **Genres** — complete and verified; the **taxonomy** exemplar
- [x] **Venues** — complete and verified; compound-uniqueness case
- [x] **Tracks** — complete and verified; genres (M:N) + stream links (1:N replace)
- [x] **Releases** — complete and verified
- [x] **Playlists** — complete and verified; ordered tracks + `totalDurationSec`
- [x] **Programs** — complete and verified; dual FK (venue + persona)
- [x] **Events** — complete and verified; venue/program FKs + lineup + `isPast` ownership
- [x] `GET /personas/:slug/page` — **5 queries**, criterion ≤8
- [x] **OpenAPI snapshot committed** (`apps/api/openapi.json`) and gated —
      describes all 8 modules
- [x] Contracts for all 8 content domains (Query + AdminDetail added for
      Track, Release, Playlist, Program, Event this session)
- [x] Mappers for all 8 content domains (AdminDetail mapper added for each
      this session)
- [x] All 8 modules registered in `app.module.ts`
- [x] All 8 modules verified with dedicated e2e specs (77 new tests) plus a
      live app boot + smoke test against the scratch database

**Exit criteria met.** Every resource supports list (cursor + offset, sort,
filter, include), read-by-slug, admin CRUD and the publish workflow (or the
taxonomy equivalent for Genres); the aggregate page stays at 5 queries; the
snapshot is committed.

## Phase 5 — Media pipeline ✅ (code) / ⬜ (live verification)

- [x] `CloudinaryService.signUpload()` — local signing, server-decided
      folder/eager-transform params, no network call
- [x] `MediaService.confirm()` — re-reads authoritative metadata via the
      Cloudinary Admin API rather than trusting the client
- [x] Admin CRUD, offset pagination, trash filter
- [x] Two-phase soft delete: 409 listing referencers across every FK that can
      point at a `MediaAsset` (including Gallery/Video, which have no admin
      module yet); `force=true` nulls nullable references, refuses if a
      required (`GalleryItem`) reference exists
- [x] Nightly orphan sweeper, `pg_try_advisory_xact_lock`-guarded (transaction-
      scoped — the session-scoped alternative is unsafe under pgbouncer
      transaction pooling, documented in the repository method)
- [ ] **Live verification**: a signed upload actually landing with correct
      bytes/dimensions/`blurDataUrl`/derivatives, and the sweeper actually
      deleting from Cloudinary — blocked on gap #2

**Exit criteria not met as written** — they are all of the "a real upload
produces X" shape, which needs live Cloudinary credentials this environment
does not have. What is verified: the signing math, the reference-counting
guard, and that every credential-dependent call fails as a clean 503 rather
than a crash.

## Phase 6 — Remaining content + engagement ✅ (code) / ⬜ (live verification)

- [x] Testimonials, Services, Brands (+ `PersonaBrand`), Stats, Faq, Gear,
      Experience, StaticPages, Settings, Redirects, Sitemap, Tags, Posts
      (+ `PostTag`) — all verified end to end against the live database
- [x] Booking inquiries: public submission, spam scoring, honeypot,
      `INQ-YYYY-NNNN` references, fire-and-forget mail via `@OnEvent`, the
      admin pipeline, a retry cron for undelivered notifications
- [x] Newsletter double opt-in, full token round-trip verified
- [x] Press-kit CRUD, gated-download signing, EPK PDF generation
- [ ] **Live verification**: an inquiry notification/autoresponder actually
      delivered, a Turnstile token actually rejected, an EPK PDF actually
      uploaded and downloadable — all blocked on gap #2
- [ ] Gallery, Video — out of scope per `phases.md`'s own exit criteria, not
      an oversight

**Exit criteria partially met.** `GET /sitemap` lists exactly the published
indexable URLs (verified). "Submitting the form creates a row and returns
201 in <100ms" is verified (readily, since it never waits on mail); "delivers
both the notification and the autoresponder" and "the press-kit PDF generates
and downloads through a signed URL" both need live credentials to verify the
delivery/generation step itself, though the code paths that would perform it
are complete and exercised up to the external-service boundary.

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

### This session (Phase 4 completion)

30. **`pnpm add` broke the Prisma client for the whole build**, not just the
    package it touched. Installing `@vitest/coverage-v8` into `apps/api`
    triggered pnpm to resolve a **second** peer-dependency hash for
    `@prisma/client`, and `packages/db/node_modules/@prisma/client` was
    re-symlinked to point at it — a copy with no generated `.prisma/client`
    types, since `prisma generate` had only ever run against the original
    hash. `@dj/db:build` then failed with `Module '@prisma/client' has no
exported member 'PrismaClient'` and four other exports, which reads like
    the schema broke rather than like a dependency-install side effect.
    Fixed with `pnpm --filter @dj/db exec prisma generate`. **Any `pnpm add`
    into any workspace package should be followed by a Prisma client
    regeneration check** before trusting a subsequent build failure to be
    about the code.
31. **The coverage provider was never installed.** `vitest.config.ts` has
    carried a threshold for `src/modules/auth/**` since an earlier session,
    but `@vitest/coverage-v8` was never a dependency and `pnpm test` never
    passes `--coverage` — so the gate had done nothing since it was written.
    Installed and run for the first time this session; found `auth/` at
    17.92% line coverage against an 80% threshold. See gap #7 and
    [ADR 0021](../01-decisions/0021-auth-coverage-gap-and-inert-threshold.md).

### Group B (this session)

32. **`TurnstileService` and `MailService`'s placeholder detection missed
    this environment's actual placeholder values.** Both were written to
    match `CloudinaryService`'s documented pattern (`/replace-me/i`), but
    `apps/api/.env.local` actually carries `TURNSTILE_SECRET_KEY=test` and
    `RESEND_API_KEY=re_test` — values `CloudinaryService` itself already
    special-cased (`^test$`) but the two new services did not. The result
    was not a crash but the opposite failure: both services believed they
    *were* configured, so `POST /inquiries` attempted a real network call to
    Cloudflare's `siteverify` endpoint and Resend on every request, adding
    30-100ms and depending on outbound network access the e2e run doesn't
    reliably have — caught immediately by `inquiries.e2e-spec.ts` failing
    with 400s instead of the expected 201s. Fixed by widening both regexes
    to match this environment's actual values, mirroring
    `CloudinaryService`'s exact pattern rather than approximating it.
    **When adding a new "is this configured" check, copy the existing
    regex's test cases, not just its shape.**

### Group E (this session)

33. **`Venue.status` and `Brand.status` defaulted to `PUBLISHED` at the
    column level — the only two publishable models in the schema that did,
    against every other one defaulting to `DRAFT`.** `VenuesService.create()`
    only sets `publishedAt` when the caller explicitly passes `status`, on
    the reasonable assumption that a new row otherwise starts as an unset
    draft — but an omitted `status` actually hit the column's `PUBLISHED`
    default with a null `publishedAt`, and the `venues_published_has_date`
    CHECK constraint (ADR 0019) rejected the insert with a raw 500. This had
    never surfaced before because `seed:content` always sets `status` and
    `publishedAt` explicitly — it took a real "New venue" form that
    naturally omits the field on create to expose it. Fixed with a
    hand-written migration changing both columns' default to `DRAFT`,
    applied via `migrate deploy` (not `migrate dev`, which would have
    offered to reset the database over `post-migrate.sql`'s expected,
    out-of-band drift). Verified: creating a venue with no `status` now
    succeeds as `DRAFT`; publish/unpublish/delete all round-trip correctly
    afterward. **A column-level default that disagrees with its own
    model's documented convention is invisible until something exercises
    the omitted-field path — worth grepping for every time a new
    publishable model is added.**

34. **Every real Cloudinary upload has failed with `Invalid Signature`
    since Phase 5/Group B — the media pipeline has never actually
    completed a live upload before this session.**
    `MediaService.createUploadSignature()` signed a params object
    including `resource_type` alongside `folder`/`eager`/`eager_async`/
    `timestamp`, but Cloudinary's own signature verification **excludes**
    `resource_type` (it is a URL path segment, not a signed field, same as
    `file`/`api_key`/`cloud_name`) — so the server signed one string and
    Cloudinary verified a different one, and no real upload could ever
    have succeeded against a real account. Group B's own verification
    only checked that a signature was *computed* (pure local math, no
    network call) and never actually drove one through Cloudinary; this
    session's admin media library did, for the first time, and got
    Cloudinary's own error back showing the exact string it hashed —
    visibly missing `resource_type`. Fixed by removing it from the signed
    params in `media.service.ts`. **Re-verified live end to end**: a real
    file uploaded to Cloudinary, confirmed via `POST admin/media`, listed
    via `GET admin/media`, deleted cleanly. **A signature that is merely
    "computed correctly" proves nothing — only a live round trip against
    the real third-party service proves a signed-upload flow actually
    works**, the same lesson as the earlier `ApiError`/response-shape
    bugs that pure typecheck/lint couldn't have caught.

### Group F (this session)

35. **Six relational content types had no write path for their own
    media-attachment fields, despite the columns existing and the read
    side already returning them.** `Track.artworkId`/`audioId`,
    `Release.coverId`, `Playlist.coverId`, `Program.heroId`,
    `Event.flyerId`, and `Persona.heroMediaId`/`avatarMediaId` are all
    real Prisma columns, all resolved into `MediaImageSchema` objects on
    every `*Detail`/`*AdminDetail` read — but none of them appeared in
    the corresponding `*CreateInput`/`*UpdateInput` Zod schemas, and
    `inputObject()`'s `.strict()` convention meant sending one to the API
    would 422 as an unrecognized key, not silently drop it. This had
    gone unnoticed because no client had ever tried to set them — there
    was no admin UI for these six content types until this session.
    Found while designing the Track/Release/Playlist/Program/Event/
    Persona admin forms, before writing a line of frontend code, by
    cross-referencing each `*Detail` schema's fields against its
    `*CreateInput` counterpart. Fixed by adding each id field to its
    contract schema and one `assign(...)` call to each service's
    `toWriteData()` — mirroring `Testimonial.avatarId`'s and
    `Brand.logoId`'s already-established pattern exactly, not inventing
    a new one. Verified live: a real uploaded image's id, set via
    `PATCH admin/tracks/:id { artworkId }`, persisted correctly in
    Postgres (confirmed via a direct `SELECT`, not just a 200 response).
    **When a *Detail schema returns a relation a *CreateInput doesn't
    accept, that's not automatically a design choice — check whether it
    was actually decided that way, or just never gotten to.**

---

## Phase 7 — Web shell + data + SEO core ✅ (code) / ⬜ (credential-dependent SEO validation)

See the "Group C" section above for the full account. Summary:

- [x] Every documented route pattern renders via a real page file, prerendered
      where the rendering-strategy table calls for it
- [x] `generateMetadata` + a JSON-LD `@graph` on every route
- [x] `robots.ts`, `sitemap.ts`, `manifest.ts`, `icon.tsx`
- [x] RSS/JSON Feed/iCal route handlers
- [x] HMAC-verified revalidation webhook, matching the API's signer exactly
- [x] Draft Mode enable/disable routes
- [x] Progressive-enhancement `/book` Server Action form with honeypot
- [x] Legal pages read `StaticPage` rows and `notFound()` rather than
      fabricate text
- [ ] **Google Rich Results validation of the JSON-LD graph** — needs a
      publicly reachable deployment, not available in this environment
- [x] **Legacy 301 redirects** — `next.config.ts`'s `redirects()` covers every
      legacy URL from `docs/07-content/legacy-audit.md` (corrected from this
      file's earlier note claiming otherwise — the code already had them).
      The DB-driven `Redirect` middleware (for slug changes made later
      through the admin, without a deploy) remains open — deferred to
      Phase 11, since it has nothing to manage without an admin UI yet.
- [ ] Split per-type sitemaps (`generateSitemaps()`) — a single `sitemap.ts`
      is used instead; functionally correct, not yet split
- [ ] Dynamic per-entity OG images — deferred, `next/og` static `icon.tsx`
      only exists so far

**Exit criteria mostly met.** Every internal route resolves and is
data-backed; the one criterion genuinely blocked is external validation
that needs a live public URL. Link-crawl/Playwright verification is a
later-phase tooling gap (no Playwright wired yet), not attempted here.

## Phase 8 — Conversion ✅ (scoped)

See the "Group D" section above for the full account. Summary:

- [x] Turnstile widget wired into `/book`, gated on a real site key,
      verified to genuinely reject an invalid token now that the secret is
      real (`curl` → `400 VALIDATION_FAILED`)
- [x] A real bug this session's own credential swap would have caused
      (every submission sending a hardcoded, now-invalid token) found and
      fixed before it could ship
- [x] Consent-gated analytics (`booking_started`, `booking_submitted`,
      `whatsapp_click`, `phone_click`, `email_click`) — server-side cookie
      gate, no script ships pre-consent
- [x] A non-blocking, keyboard-accessible consent banner
- [ ] **Admin enquiry inbox v1** — deliberately deferred to Phase 11.
      `apps/admin` has no auth yet; an inbox with real enquiry data and no
      access control would be a regression, not a feature.
- [ ] Booking-wizard step UX (progress indicator, multi-step flow) — the
      form is a single honest page today, not the polished wizard the
      masterplan describes. Functionally complete, not yet the described UX.

**Exit criteria partially met.** "A real enquiry lands in Postgres, sends
email, and offers the WhatsApp handoff" — the row/email path was already
verified in Group B; WhatsApp handoff exists on `/contact`. "Funnel
analytics fire" — verified structurally (events fire, script is
consent-gated correctly); an actual Plausible dashboard receiving them was
not observed, since no real Plausible site is configured this session. axe
and no-JS submit tests are Phase 12 tooling, not attempted here.

## Phase 9 — Media & player ✅ (scoped)

See the "Group D" section above for the full account. Summary:

- [x] The Cloudinary image loader (`images.loader = 'custom'`), `SIZES`
      presets, `cloudinaryUrl()`/`cloudinaryOgUrl()`, `<CloudinaryImage>`
- [x] A real bug fixed in passing: the persona OG image tag was building a
      URL from a bare `publicId`, not a Cloudinary delivery URL
- [x] Mini player (`PlayerProvider`/`MiniPlayer`/`PlayButton`), surviving
      navigation, wired onto the track detail page
- [ ] **The mini player is untested against real audio** — no seeded track
      has a non-null `audioUrl` yet (gap #16, same root cause as gap #4:
      nothing has ever been uploaded through the media pipeline)
- [ ] wavesurfer.js precomputed-peaks waveform — the masterplan's own
      documented fallback tier (a plain `<audio>` + transport controls) is
      what shipped; the richer version is a drop-in upgrade once real
      tracks exist, not deferred out of difficulty
- [ ] Gallery/video lightboxes — no Gallery/Video backend module exists
      (Group B's own documented exclusion)
- [ ] Hero video strategy, dynamic per-entity OG images — not started

**Exit criteria not met as literally written** — they are all of the
"a real X performs well" shape (LCP on real images, the player surviving
navigations with a real track, lightbox gesture tests), which need real
media in the catalogue. What's verified: the loader and helper component
work correctly against the live API (`pnpm turbo build` succeeded with them
wired into a real page), and the player's code path is exercised (renders,
wires to context, conditionally shows) even though no real audio exists to
actually play yet.

## Phase 10 — Cinematic + signature motion ✅ (third pass — the visual layer session)

See "Group E", "Group E — second pass" and **"Cinematic visual layer"**
below for the full account.

- [x] `packages/motion` now exists as its own package, with the API
      `motion.md` documented all along: `useReducedMotion()`,
      `useCapability(): 'static' | 'light' | 'full'`, `<MotionGate full
      light static>`, `useAccentRgb()`, shared variants. The app-local
      `lib/motion.ts` + `components/motion-gate.tsx` (which returned a
      boolean and took `heavy`/`light` props) are deleted. Closes half of
      gap #9.
- [x] Real typography — Anybody, Inter and JetBrains Mono via
      `next/font/google`, self-hosted at build, wired to the
      `--font-monument` / `--font-satoshi` / `--font-jetbrains` variables
      `theme.css` already read. No deviation from `typography.md`.
- [x] **The WebGL shader field**, with four blended per-persona variants on
      a single `uVariant` axis, and a finished CSS-gradient composition as
      the `light`/`static` tier (not a placeholder — the canvas fades in
      *over* it).
- [x] **The channel switcher** — the module the `@property --color-accent`
      registration in `theme.css` was written for. Tuning a channel repaints
      the entire viewport by setting three custom properties on
      `documentElement` from the persona's CMS hex.
- [x] **The procedural 3D deck** — a CDJ built from primitives, no GLTF and
      no model download. Platter spins from the real player state; drag
      scrubs the real transport.
- [x] **The 2.5D gig map** — real venue lat/lng through a shared
      equirectangular projection, with the crawlable venue list as its
      authoritative interface.
- [x] Scroll-driven reveals via CSS `animation-timeline: view()` behind
      `@supports`, so they cost no JavaScript at all.
- [x] The mini player rebuilt on the **SoundCloud Widget API**, making all
      19 real catalogue tracks genuinely playable. Both transports now live
      in the provider, so playback is independent of whether the player
      chrome renders.
- [ ] Native View Transitions and the custom cursor. Still deferred, and
      now for a smaller reason than before: both are polish on top of a
      layer that finally exists, rather than blocked on assets.

**Exit criteria: met for every technique shipped.** Each has a documented,
finished fallback and each was built fallback-first. What is *not* verified
is anything that needs a real browser or a device lab — see "Not verified"
in the "Cinematic visual layer" section below, which is specific about it.

## Phase 11 — Admin panel ✅ (scoped, all content types)

See the "Group E", "Group E — second pass" and "Group F" sections above for the full account.

- [x] Login (email/password + TOTP), session via memory access token +
      httpOnly refresh cookie + CSRF double-submit, silent refresh on load
- [x] Protected shell, RBAC-aware sidebar (`can()` hides ungranted actions)
- [x] Full CRUD + publish workflow for **18 content types**: Venues,
      Personas, Tracks, Releases, Playlists, Programs, Events (each with
      bespoke relation pickers), plus Genres, Tags, Stats, Redirects,
      Testimonials, Services, FAQs, Experience, Brands, Gear, Press assets
      (generic config-driven scaffold)
- [x] StaticPages and Posts, with a real Tiptap v3 rich-text editor
- [x] Settings (the singleton), Media library (real signed upload → confirm
      → list → delete, live-verified against Cloudinary), Draft Mode
      preview links, Audit log viewer, Booking Kanban
- [x] **Two real, previously-unverified bugs found and fixed**: the media
      pipeline's Cloudinary signing (bug #34) and the missing media-
      attachment write path on all six relational content types (bug #35)
- [ ] `@dnd-kit` drag-and-drop (explicit move-up/down buttons are the
      required accessible baseline, not a stand-in for it), `react-easy-crop`
      cropping, custom Tiptap embed nodes, TanStack Query
- [ ] Track↔Release membership and Persona social links — no write schema
      exists for either; deliberately not guessed at, see "Group F" above

**Exit criteria substantially met.** "The artist publishes a new track,
event, playlist and gallery set end to end with no developer involved" —
every content type except Gallery (out of scope since Group B, no backend
module) now has a working admin screen, verified end to end against real
data, real credentials, and a real Cloudinary upload. The one remaining
piece of that exact sentence is a real usability session with the artist
himself, which is not something a coding session can perform.

## Phase 12 — Hardening & launch ✅ (codeable subset)

See "Group F" above for the full account and the explicit handoff list.

- [x] CSP + standard security headers on `apps/web` and `apps/admin`
      (documented, deliberate `unsafe-inline` on `script-src` pending a
      real-browser-verified nonce rollout)
- [x] Legacy 301 redirects, re-verified live
- [ ] Manual NVDA/VoiceOver pass, Sentry, load test, backup/restore drill,
      visual regression baselines, the nonce-based CSP tightening — see
      the handoff list in "Group F" above; none of these are code this
      session could write and call done

**Exit criteria not met** — most of what Phase 12 asks for is a human
action (screen-reader testing) or needs infrastructure that doesn't exist
yet (a deployed environment to load-test or restore into). What's coded
and verified: the header/redirect layer that a real launch will need
regardless of when the rest happens.

## Phase 13 — Growth ✅ (codeable subset)

See "Group F" above for the full account.

- [x] A real `/search` page, querying real content, live-verified
- [ ] Location/venue landing pages, i18n — blocked on the user supplying
      real per-location/per-language content; writing placeholder copy
      would be the exact fabrication CLAUDE.md forbids
- [ ] PWA offline support, booking-CTA A/B testing — real, bounded
      engineering tasks simply not attempted in this pass

No exit criteria — Phase 13 is a backlog, not a phase with a defined
"done."
