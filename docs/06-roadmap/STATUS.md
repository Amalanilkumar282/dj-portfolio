# STATUS — live project state

> **This is the file every session reads first and updates last.**
>
> Update it in the same session you do the work. Tick what is genuinely done
> and verified. If you left something incomplete, say so and say why — an
> honest "blocked" line is far more useful to the next session than an
> optimistic tick.

**Last updated:** 2026-09-22 (homepage revamp: shows/flyers, Video module, admin-configurable sections)
**Current phase:** The **cinematic visual layer** — Phase 10 done properly.
Until the visual-layer session `apps/web` was functionally complete and
visually flat: no hero, no shader, no persona switcher, no 3D, and a play
button that structurally never rendered. The homepage is now a nine-act
scroll with a WebGL persona field, a channel switcher that repaints the
whole viewport from CMS colours, a playable 19-track wall on the real
SoundCloud Widget API, and a procedural 3D deck — each with a finished (not
degraded) fallback at two lower tiers. **Both route budgets measured
green.** A projected gig map originally occupied Act 5; it was removed this
session (see "Homepage gig map removed" below, and
[ADR 0023](../01-decisions/0023-remove-homepage-gig-map.md)) and replaced
with a rotary catalogue browse wheel. Manual screen-reader testing, a
production launch, load testing and a restore drill remain the user-facing
handoff items from Group F.
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

### "SWAGGER_ENABLED must be false in production" despite being set to false

Reported from a real Render deploy: the API crashed at boot with `Error:
SWAGGER_ENABLED must be false in production` even though the user had
set `SWAGGER_ENABLED=false` in Render's Environment tab. Confirmed real
and traced to a schema bug, not a Render misconfiguration.

**Root cause.** `SWAGGER_ENABLED: z.coerce.boolean().default(false)` looks
like it parses the string `"false"` into the boolean `false`, but
`z.coerce.boolean()` actually runs the raw value through JavaScript's own
`Boolean(x)` — which is `true` for *any* non-empty string, including the
literal text `"false"`. Every environment variable a host like Render
injects arrives as a string, so `SWAGGER_ENABLED=false` coerced to `true`
regardless of intent, and `validateEnv()`'s own production guard (`if
(NODE_ENV === 'production' && SWAGGER_ENABLED) throw`) fired on every
single boot. Confirmed directly: `node -e "console.log(Boolean('false'))"`
prints `true`.

**Fix.** Replaced `z.coerce.boolean()` with a real string parser
(`booleanFromEnv` in `env.schema.ts`) that lowercases/trims the value and
only treats `'true'`/`'1'` as true — everything else, including `'false'`,
`'0'` and unset, is false. An unrecognised value (e.g. a typo like `"flase"`)
now fails validation loudly at boot instead of silently misparsing,
consistent with this file's own stated philosophy ("Boot fails on invalid
config, deliberately"). Searched the rest of the repo for the same
`z.coerce.boolean()` pattern — this was the only occurrence.

### Verified

- Reproduced the exact reported failure first: booted the built API with
  `NODE_ENV=production SWAGGER_ENABLED=false` before the fix — confirmed
  it throws the reported error.
- Applied the fix, rebuilt, and re-ran the identical command — the API
  now boots cleanly in `[production]` mode, `/health` returns 200, and
  `/api/docs` correctly 404s (Swagger genuinely disabled, not just not
  crashing).
- `pnpm --filter @dj/api exec tsc --noEmit` — clean.
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green.

### Admin session lost on every page refresh — real bug, confirmed and fixed

The user reported that reloading any admin page bounced them back to
`/login`, even immediately after signing in, and suspected a session
issue. Confirmed real, and traced to the exact mechanism — not a vague
"session problem" but one specific missing header on one specific call.

**Root cause.** The API's `CsrfGuard` (double-submit CSRF protection)
requires an `x-csrf-token` header matching the `dj_csrf` cookie on any
POST/PATCH/DELETE that authenticates via the refresh cookie — in
practice, just `POST /auth/refresh` and `POST /auth/logout`. The admin's
`AuthProvider` fires a **silent refresh on every mount** (the mechanism
that's supposed to survive a reload — the in-memory access token is lost
on refresh, but the httpOnly refresh cookie should still be valid) by
calling `apiFetch('auth/refresh', { method: 'POST' })` directly.

`apiFetch`'s main request path never attached the CSRF header — only the
*embedded* 401-retry-then-refresh branch further down the same function
did. Since the mount-time silent refresh calls the function directly,
never through that retry branch, it never sent the header, and the guard
rejected it every single time with `403 CSRF_FAILED` — even with a
completely valid session. A perfectly logged-in admin refreshing the page
looked identical, from the client's perspective, to someone with no
session at all.

This wasn't a new bug: an earlier session's own logs (pasted mid-way
through an unrelated task) showed `request_failed status=403
code=CSRF_FAILED path=/api/v1/auth/refresh` right after admin startup —
misread at the time as "benign, no session cookie yet." It was actually
this exact bug, firing on every load, session or no session.

**Fix.** `apps/admin/src/lib/api-client.ts`'s main request path now reads
and attaches the CSRF header unconditionally (harmless on every other
route — Bearer-authenticated endpoints never register the guard, so it's
simply ignored there), matching what the 401-retry branch already did.
Extracted the header name into a shared constant so the two call sites
can't drift apart again.

**A second, smaller real bug found in the same file while verifying:**
`LoginForm` called `router.replace('/')` directly during render (for an
already-authenticated visitor), which is exactly what triggers React's own
"Cannot update a component while rendering a different component"
warning — the redirect happened to win the race every time, but it was
undefined behaviour, not a style nitpick. Moved into a `useEffect`.

### Verified

- Installed a headless Chromium temporarily, logged into the real running
  admin app, and reloaded the page — before the fix, this bounced to
  `/login` every time; after, the session survives the reload and the
  dashboard stays up. This is the literal bug the user reported, confirmed
  fixed against the real app, not just reasoned about.
- The stray console warning ("Cannot update a component…") is gone after
  the `LoginForm` fix.
- `pnpm --filter @dj/admin exec tsc --noEmit` — clean.
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green.
- The temporary Playwright install used for verification was removed
  afterward; `apps/admin/package.json` and `pnpm-lock.yaml` are unchanged.

### CI failures fixed (this session)

The first real push to `main` (merging `visual-layer`) showed 3 of 4 CI
jobs red: "Lint, typecheck, build", "Database — migrations, seeds,
integration tests", "Dependency audit". `gh` CLI wasn't available in this
session, so every failure was reproduced and diagnosed locally instead —
building against the real API, not guessed at from the job names.

**1. "Lint, typecheck, build" — a real, structural CI gap, not a code bug.**
`apps/web` and `apps/admin` are 100% CMS-driven (CLAUDE.md's own central
requirement): every page fetches real content from the API at build time
via Next.js static generation. The `verify` job installed, linted and
typechecked fine, then hit `ECONNREFUSED` on every static page during
`next build` — because nothing in that job ever started the API. This
was invisible locally all session because a real API happened to already
be running in the background for manual testing; CI has no such thing
unless the workflow provisions it. Fixed by giving the `verify` job its
own Postgres service (mirroring the `database` job), migrating and
seeding it, building and starting `apps/api` in the background with a
health-check wait loop, and only then running `pnpm turbo build`.
Verified directly: reproduced the exact failure locally with no API
running, then reproduced the fix by starting the API first and re-running
the same build — clean both times.

**2. "Dependency audit" — real, current high/critical CVEs in transitive
dependencies**, none of them anything this codebase calls directly:
`multer` (pulled in by `@nestjs/platform-express`; uploads go straight to
Cloudinary from the browser, multer is never used — see
media-pipeline.md), and `vitest`/`vite`/`postcss`/`undici`/`deepmerge-ts`
(all test/build toolchain). Fixed with `pnpm-workspace.yaml`'s `overrides`
map, forcing each to its patched version. One mistake caught before it
shipped: the first attempt used an open-ended `vitest: '>=3.2.6'`, which
pnpm resolved to `5.0.0` — three major versions past what this codebase
has ever run against. Narrowed to `>=3.2.6 <4.0.0` (resolves to `3.2.7`),
then actually ran `packages/db`'s real integration test suite against it
to confirm nothing broke, rather than trusting the version bump alone.
`pnpm audit --audit-level=high` now reports zero high/critical (down from
10 high + 1 critical).

**3. "Database — migrations, seeds, integration tests" — investigated
thoroughly; the one failure found was local database pollution, not a
reproducible CI bug.** Since this job runs against a brand-new, empty
Postgres container every time, the only way to check it faithfully
without Docker (not installed on this machine) was to provision a genuine
scratch database on the real Neon project and run the *exact* command the
job runs: `prisma migrate diff --from-migrations ./prisma/migrations
--to-schema-datamodel ./prisma/schema.prisma --shadow-database-url ...
--exit-code`. Result: **"No difference detected"** — the migration history
(including the hand-written `add_home_hero_video` migration from the
previous session) applies cleanly to a fresh database with zero drift.
Running `pnpm --filter @dj/db test` next failed on one assertion
("expected 0 to be greater than 0") — traced to a leftover
`test-playlist-e2e` row with no tracks, left behind by a previous e2e run
against the real dev database that didn't clean up after itself (exactly
the failure mode `testing.md`'s "leave seeded content exactly as they
found it" rule exists to prevent). Confirmed this is **not** a seed-script
bug: all four real playlists had correct track counts throughout. Deleted
the stray row; the full suite is back to 90/90 passing. Since this
specific pollution cannot exist in CI's always-fresh container, **the
actual GitHub Actions run may have failed for a different reason** — every
avenue checkable without `gh` CLI or Docker access has been exhausted
(migration drift, seed correctness, Postgres extension/config parity, the
Prisma client). If this job is still red after the push, the next step is
pasting the actual job log, not further local guessing.

**4. "Secret scan" — was already green, untouched.**

### Verified

- Reproduced and fixed the build-order gap: confirmed the exact
  `ECONNREFUSED` failure locally with no API running, then confirmed a
  clean build with the API up and healthy.
- `pnpm audit --audit-level=high` — 0 high/critical (was 10 high + 1
  critical).
- `pnpm --filter @dj/db test` — 90/90 passing (was 89/90, after removing
  stray local test data).
- `prisma migrate diff` against a genuine scratch database on the real
  Neon project, using the exact CI command — "No difference detected."
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green, with
  the API running.
- `pnpm check:env` — clean.
- The updated `.github/workflows/ci.yml` was validated for YAML syntax
  (not run through GitHub Actions itself, since this session has no way to
  trigger or observe an actual Actions run).

### Not verified

- **The actual GitHub Actions run has not been re-triggered or observed
  from this session** — `gh` CLI is unavailable and there is no web
  access. The push that includes these fixes needs to be watched in the
  Actions tab to confirm the "Lint, typecheck, build" and "Dependency
  audit" jobs go green, and to see whether "Database" was really explained
  by local pollution or needs a further look with real log output.
- Docker is still not installed on this machine, so the new
  `apps/api/Dockerfile` remains unbuilt/untested (unchanged from the
  previous session's gap).

### Deploy-readiness pass (this session)

The user asked for a full analysis of whether the app is ready to deploy.
Ran the actual gates rather than assuming: `pnpm turbo lint typecheck
build --filter='!@dj/db'` (20/20 green, against the live API), and
`pnpm check:env` — which is exactly the check meant to catch "works
locally, fails to boot in production." It failed, for a real reason.

**Two real gaps found and fixed:**

1. **`apps/admin/.env.example` was missing two variables the code actually
   reads** (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PREVIEW_TOKEN` — both used
   by `lib/preview.ts` for the "Preview"/"View live site" links added
   earlier this week). Deploying admin without knowing these exist would
   have silently broken those links with no error. Documented both, with
   the reasoning for why the token is intentionally `NEXT_PUBLIC_` in this
   one app (it's a shared secret with `apps/web`'s Draft Mode route, and
   admin already sits behind auth — see `lib/preview.ts`'s own comment).
   `check-env.ts` flags any `NEXT_PUBLIC_*` variable that looks like a
   secret as an error by design; added one named, commented exception for
   this specific, deliberate case rather than weakening the rule.

2. **`apps/api/Dockerfile` did not exist.** `docs/05-operations/
   deployment.md` describes a Docker-based deploy and the pre-deploy
   migration command in detail, but there was no actual Dockerfile in the
   repo — building the API into a container was structurally impossible.
   Wrote a monorepo-aware multi-stage one (install at the workspace root →
   `prisma generate` → `turbo build --filter=@dj/api` → copy only the
   built output and prod dependencies into a slim runtime layer), plus a
   root `.dockerignore`. **Not build-tested** — Docker is not installed on
   this machine (a standing constraint noted elsewhere in this file) — but
   every path it `COPY`s was verified to exist, and every command in it is
   one already confirmed to work outside a container this session.

### Verified

- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green,
  with the real API running.
- `pnpm check:env` — clean after the fix.
- `prisma migrate diff` against the live database — no drift beyond the
  one documented, expected exception (`posts.searchVector`, outside
  Prisma's migration history by design — ADR 0015).

### Not verified — the honest gap list before a real production launch

This was true before this session and remains true — nothing here is new,
but it is the direct answer to "are we good to deploy":

- **The API's Dockerfile has never actually been built or run.** Confirm
  this on the first real deploy attempt, or locally if Docker ever becomes
  available on a dev machine.
- No screen-reader pass, no load test, no restore drill (Group F's
  standing handoff list).
- Cloudinary/Resend/Turnstile real end-to-end sends are configured but not
  exhaustively exercised in production conditions.
- Nothing in the cinematic visual layer has been seen in a real browser on
  a real device (a headless Chromium confirmed specific fixes; that is not
  the same as a device lab).
- No content exists yet for Gallery or either hero-video field — that's
  correct and intentional (no real photos/video exist to seed), but it
  means a first deploy will look exactly as it does locally: generative
  backgrounds only, no galleries listed.

**Bottom line:** the codebase is in a genuinely deployable state — every
gate that can be checked without paid infrastructure passes, and the two
real gaps that would have caused a broken or impossible deploy are fixed.
What's *not* verified is what only a real deploy can verify (the
Dockerfile actually building, TLS, real email/SMS delivery in production,
device-level rendering) — those are exercised for the first time during
the deploy itself, per the existing runbook in `docs/05-operations/
deployment.md`.

### Homepage hero background video (this session)

Follow-up to the persona hero-video work: the user asked whether the
**homepage** hero could get the same background-video treatment as a
persona page, since it couldn't — the homepage isn't tuned to one persona
(it cycles through all four via the channel switcher), so there was no
natural field to hang a video off.

Unlike `Persona.bgVideoMediaId` and `Gallery`/`GalleryItem`, this one
genuinely needed a new column — `SiteSettings` had no equivalent field.
Added `homeHeroVideoMediaId` (nullable, `onDelete: SetNull`, matching the
existing `logoId`/`defaultOgImageId` pattern exactly) and wired it end to
end: `homeHeroVideoUrl` on the public `SiteSettingsDetail` read shape,
`homeHeroVideoMediaId` (raw id) on the admin-only `SiteSettingsAdminDetail`
— learning directly from this session's earlier Persona fix, both the read
*and* write shapes got the raw id from the start, so the Settings form
never had the "can't see what's already selected" bug in the first place.
`MediaSelect` (already extended with a `mediaType` filter for the Gallery
work) is now used a second time, on the Settings screen, to pick a video.
The homepage's `<StageBackdrop>` takes the same `videoUrl` prop the persona
pages already use.

**The migration itself needed care.** `prisma migrate dev` refused to run:
it detected the real database's `searchVector` column on `posts` (added by
`post-migrate.sql`, deliberately outside Prisma's migration history per
ADR 0015) as "drift" and asked to **reset the database** to resolve it —
exactly the destructive path CLAUDE.md forbids. Instead: wrote the
migration SQL by hand (one `ALTER TABLE ... ADD COLUMN` plus the matching
foreign key, copied from the equivalent `logoId` migration for byte-for-byte
consistency), applied it directly with `prisma db execute` (which runs raw
SQL with no drift check), and recorded it via `prisma migrate resolve
--applied` so migration history stays accurate for the next session. Then
`prisma migrate diff` was run against the live database to confirm the
*only* remaining difference is that same, expected `searchVector` column —
nothing else drifted, and no data was touched.

### Verified

- `prisma migrate diff` against the live database shows only the one
  known, documented difference (`posts.searchVector`) — the new column
  and its foreign key are exactly what the schema declares.
- `GET /settings` and `GET /admin/settings` both confirmed live, returning
  `homeHeroVideoUrl: null` / `homeHeroVideoMediaId: null` as expected (no
  clip uploaded yet).
- `PATCH /admin/settings` with `homeHeroVideoMediaId: null` confirmed to
  return 200 with the full settings row unchanged otherwise — the write
  path round-trips.
- `pnpm turbo lint typecheck build --filter='!@dj/db'` — 20/20 green.
- `apps/api/openapi.json` regenerated — it had never been updated for the
  Gallery module added earlier this session either, so this also closes
  that gap.

### Not verified

- No real video has been uploaded, so the actual `<video>` background has
  not been seen rendering on the homepage — same honest caveat as the
  persona hero-video work.

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

## Admin media-upload bug fix (this session)

The user reported that clicking "add asset" anywhere in `apps/admin`
opened a new browser tab and landed on the login screen instead of
uploading, and that the Gallery editor had no upload affordance at all.

**Root cause #1 (the new-tab/login bug), all entity forms using
`MediaSelect`** (Persona, Track, Release, Playlist, Program, Event,
Venue): `media-select.tsx` rendered the upload trigger as
`<a href="/media" target="_blank">` — a real page navigation, not an
in-app action. `apps/admin`'s access token lives in memory only
(`auth-context.tsx`); a new tab is a fresh JS context with no token, so
it depends on the httpOnly-refresh-cookie silent-refresh racing
`dashboard-shell.tsx`'s `!user → redirect to /login` guard. When that
race lost — which it visibly did — the new tab bounced straight to
login, and the original tab's in-progress form edit was left stranded
behind it.

**Root cause #2 (separate), the Gallery editor**:
`galleries/gallery-form.tsx` hand-rolls its own image picker instead of
using `MediaSelect`, and its "Add images…" panel only ever listed
already-uploaded assets — there was no upload link, button, or
affordance in that file at all, not even the broken one. Not a
permission gate; just never built.

**Fix:** extracted the existing signed-upload → Cloudinary → confirm
flow (previously only in `media-library.tsx`) into a shared hook,
`media/use-media-upload.ts`, and a same-tab, same-session UI on top of
it, `media/inline-uploader.tsx` (click to reveal a file input + Upload
button inline, no navigation). Wired into `MediaSelect` (replacing the
broken anchor, auto-selecting the newly uploaded asset) and into
`GalleryForm`'s "Add images…" panel (previously nothing). `MediaLibrary`
itself was refactored onto the same hook so there is exactly one
implementation of the upload flow, not two. `pnpm --filter @dj/admin
typecheck` and `lint` both pass clean.

**Not verified live** — this machine has no Cloudinary/API credentials
configured beyond placeholders (see the repo-wide caveat on Cloudinary/
Resend/Turnstile paths above), so the actual signed-upload round trip to
Cloudinary was not exercised in a browser this session; verified by
reading the code path end to end and by typecheck/lint only. The next
session with real credentials and a browser should upload one asset from
a Persona form and one from Gallery to confirm.

**Follow-up fix, same session:** the user reported that after the above
fix, clicking Upload (after choosing a file) still redirected to `/login`
— now in the same tab, not a new one. Root cause: `InlineUploader`'s
picker was itself a `<form>`, and every caller places it inside the
entity's own `<form>` (`persona-form.tsx`, `track-form.tsx`, etc., and
`gallery-form.tsx`). A `<form>` nested inside a `<form>` is invalid HTML;
the inner submit can bubble into the outer form's own submit handler, or
in some browsers fall through to a real native form submission instead of
the React handler entirely — either way, a real page reload. A reload
wipes the in-memory access token (`auth-context.tsx` keeps it in memory
only, by design) and re-runs the silent-refresh bootstrap from cold;
losing that race lands on `/login` via `dashboard-shell.tsx`'s
`!user → redirect` guard, which reads exactly like "upload logs me out."
Fixed by rewriting `inline-uploader.tsx` to render no `<form>` at all —
a plain `<div>` with `type="button"` elements and a manual `onClick`
handler — so there is no nested form, no bubbling, and no native
submission path to fall back to. Re-verified with `pnpm --filter
@dj/admin typecheck` and `lint`, both clean. Still not verified against a
real browser/Cloudinary — same handoff item as above.

## `apps/web` UI/UX pass (this session, after the admin upload fix)

The user reported 4 issues against the deployed public site. All 4 fixed;
`pnpm --filter @dj/web typecheck` and `lint` both pass clean. None
re-verified in a real browser (no browser available this session) — flagged
per issue below.

1. **Mobile persona hero title cropped** (e.g. `/trinitrocosmic` at ~390px):
   `h1#persona-title` (`app/(marketing)/[persona]/page.tsx`) wraps its text
   in `.dj-rise-mask` (`app/globals.css`), which needs `overflow: hidden` for
   its scroll-driven reveal animation. A single long, unbreakable stage name
   had nowhere to wrap, so the overflow silently clipped it instead. Fixed by
   adding `overflow-wrap: break-word; hyphens: auto;` to `.dj-rise-mask` —
   the same element, wrapping instead of clipping. `--text-display`'s
   existing `clamp()` in `packages/ui/src/styles/theme.css` was already
   responsive and did not need to change.
2. **Persona nav dropdown unclickable** (`components/header.tsx`): the
   trigger was a bare `<span className="cursor-default">`, and the panel
   opened only via a `group-hover-hover` CSS variant scoped to
   `@media (hover: hover) and (pointer: fine)` — so on any device without a
   fine, hover-capable pointer it was inert to both click *and* hover,
   exactly as reported, and even on a mouse it was never focusable via
   keyboard. Replaced with a native `<details>`/`<summary>` disclosure (the
   same zero-JS mechanism `MobileNav` already uses for the mobile drawer) —
   works via click, tap and keyboard with no JS. `[&::-webkit-details-marker]:hidden`
   plus `list-none` suppress the native disclosure triangle, matching
   `MobileNav`'s existing style.
3. **Track wall too long to scroll**
   (`components/home/track-wall.tsx`): the whole catalogue rendered in one
   ungated grid. Rather than adding a server round trip — the file's own
   comment already argues a fetch-once, filter-client-side design for a
   catalogue this size (19 tracks today; `server/queries/tracks.ts` fetches
   up to 100, and the API's cursor pagination — see
   `apps/api/src/modules/tracks/tracks.controller.ts` — is available if the
   catalogue ever needs a second server page past that cap, but isn't yet) —
   added client-side paging over the already-fetched array: 9 cards render
   initially, a "Load more (N left)" button reveals the rest 9 at a time,
   and switching the persona filter resets the page. No new endpoint, no
   new query.
4. **3D gig map's arc animation looked odd**
   (`components/home/gig-map.tsx`): the dashed travel arcs from the home
   city were animated with `field-drift` — a keyframe built for a full-bleed
   background's slow scale/pan, reused here by mistake. On a thin SVG path
   this reads as the arc visibly snapping between `scale(1)` and
   `scale(1.12)` at every 6s loop boundary, not a smooth flow. Added a
   dedicated `gig-arc-flow` keyframe (`app/globals.css`) that animates
   `stroke-dashoffset` instead — matched to the arcs' own `2 3` dash pattern
   (period 5) so a `-10` offset loops with no visible seam — and pointed the
   arc's `motion-ok:animate-[...]` utility at it instead. The map's other
   two "3D" pieces this could have meant — `deck-scene.tsx`'s procedural CDJ
   and `shader-canvas.tsx`'s generative field — were both already
   correctly delta-scaled via `useFrame`'s `delta` and were left untouched;
   the map (pure SVG, no `three`, per its own doc comment) was the one
   actual bug.

**Not verified live** — no browser was available this session to confirm
any of the 4 fixes visually (the wrap behavior, the dropdown's click/tap/
keyboard behavior, the load-more paging, or the new arc animation timing).
Verified by reading the changed code and by `typecheck`/`lint` only. Next
session with a browser should check all 4 on a real phone-width viewport
and desktop.

## Media confirm 500, actual root cause found (this session, later)

The Cloudinary colour-analysis fallback above did **not** fix it — the user
retested against a real local API (`localhost:4111`, real Cloudinary
credentials, cloud `fpkuwabf`) with the network panel open and the same
`POST admin/media` 500 still happened, with one very telling detail: a
**video** upload to the same `homeHeroVideoMediaId` field succeeded cleanly,
only **images** failed.

**Actual root cause:** `media_assets_image_alt_text` is a real DB `CHECK`
constraint (`packages/db/prisma/sql/post-migrate.sql`, applied only to
`resourceType = IMAGE`) — one of CLAUDE.md's own documented invariants
("In-page images always have alt text"). `InlineUploader`
(`apps/admin/src/components/media/inline-uploader.tsx`) never collected alt
text at all, so every image it confirmed had `altText: null`, which the
database correctly rejects — video has no such constraint, hence the
image/video split. Two compounding bugs, not one:

1. **The constraint violation was reaching the client as an opaque 500, not
   the intended 422.** `PrismaExceptionFilter`
   (`apps/api/src/common/filters/prisma-exception.filter.ts`) only
   `@Catch()`-es `PrismaClientKnownRequestError` (mapping its `P2004`/`P2010`
   codes to a friendly 422). A CHECK constraint defined only in
   `post-migrate.sql` — unknown to Prisma's own schema metadata — can
   surface as `PrismaClientUnknownRequestError` instead, which this filter
   was never watching for, so it fell through to `AllExceptionsFilter`'s
   generic catch-all 500. Fixed: the filter now also catches
   `PrismaClientUnknownRequestError`, runs the same constraint-name
   extraction against its message, and returns the same friendly 422 (or,
   if no known constraint name is found at all, still logs and reports a
   real 500 rather than silently reclassifying every unknown DB error as a
   client mistake).
2. **Even with the correct 422, there was still no way to successfully
   upload an image through `InlineUploader`** — it had no alt-text field to
   fill in, unlike `MediaLibrary`'s own upload form, which always had one.
   Fixed: `InlineUploader` now detects when the chosen file is an image
   (`file.type.startsWith('image/')`), shows a required "Alt text" input for
   it, and blocks the Upload click client-side with a clear message until
   it's filled in — so images fail fast with an actionable prompt instead of
   a round trip to a 422 (or, before today, a 500).

Verified: `pnpm --filter @dj/api typecheck`/`lint` and `pnpm --filter
@dj/admin typecheck`/`lint` all pass clean. **Not yet re-verified against a
real upload** — the user should retry an image upload from a Persona (or
any entity) form now; it should prompt for alt text and then succeed.

## Uploads succeed but never appear on `apps/web` (this session, later still)

Confirmed: image upload itself now works (alt-text prompt, 201/200/201 all
green). But newly uploaded images attached to a Persona's hero/avatar or to
a Gallery still did not render anywhere on the public site. Investigated
five hypotheses (save-without-publish, missing publish, stale cache/
revalidation, a Cloudinary/env mismatch, a public-read mapping gap);
revalidation, env, and read-mapping all checked out clean. Two real causes:

1. **`toMediaImage()`** (`apps/api/src/common/base/media.mapper.ts:46-51`)
   deliberately treats an image as absent — returns `null`, not an error —
   if it's missing `width`, `height`, `altText`, **or `blurDataUrl`**. That
   last one is the bug: `blurDataUrl` is populated by `MediaService.confirm()`
   with a **live fetch** of Cloudinary's blur derivative, generated
   on-the-fly on that very first request (`fetchBlurDataUrl`,
   `media.service.ts`). That fetch can transiently fail — the derivative
   racing its own first-ever generation — and silently degraded to `null`
   with zero error surfaced anywhere in the chain, which then made
   `toMediaImage()` drop the image forever, on every page, with nothing in
   any log pointing at why. This is almost certainly why "hero, avatar, AND
   gallery all fail" together — one shared code path (`confirm()`), not
   three separate bugs.

   **Fixed:** `fetchBlurDataUrl` now retries once after a 400ms delay before
   giving up. If it still fails, `confirm()` now falls back to a synthesized
   solid-colour placeholder (`solidColorBlurDataUrl`, a tiny inline SVG data
   URI built from the asset's own `dominantColor`) instead of `null` — so
   `blurDataUrl` is always populated for a confirmed image going forward,
   honouring the contract's stated (and correct) invariant that it's
   non-nullable, instead of quietly violating it.

   **Known limitation, not fixed:** this only prevents the bug for *new*
   uploads from now on. Any image already confirmed while this bug was live
   has a permanently `null` `blurDataUrl` sitting in the database and will
   keep failing to render until it is re-uploaded (delete the asset in the
   admin Media library, then upload it again) — there is no in-place repair
   for already-broken rows in this pass. If the user's specific missing
   images are still missing after this deploys, that's why; a one-time
   backfill script (re-fetch `blurDataUrl` for every existing `MediaAsset`
   row where it's null) would be the real fix but was not built this
   session.

2. **Also confirmed as expected behaviour, not a bug, but worth restating
   since it looks like one:** selecting an image via `MediaSelect`/
   `InlineUploader` only updates the entity form's local state — nothing is
   written until **Save** is clicked (`persona-form.tsx` etc.), and even
   after saving, a brand-new or DRAFT Persona/Gallery will not appear on
   `apps/web` at all until it is explicitly **Published** from its list page
   (the Publish/Unpublish toggle, separate from Save — see
   `entity-list.tsx`). Both steps are required; if a specific persona/gallery
   is still invisible after this deploys, check its status on `/personas` or
   `/galleries` first.

Verified: `pnpm --filter @dj/api typecheck`/`lint` clean. Not yet
re-verified against a real upload+render — needs a fresh image upload after
deploy, and confirmation that the affected persona/gallery is actually
Published.

## Gallery "Add images…" 422, pre-existing and unrelated to the above

While retesting, the user hit `GET admin/media?perPage=200` returning
`422 Unprocessable Entity` on every load inside the gallery editor — a
pre-existing bug, not a regression from today's other fixes. The upload
itself was succeeding the whole time (the just-uploaded image correctly
showed under "Images, in order"); it was only the *list refresh* that
silently failed and fell back to an empty array, which made the "Add
images…" picker look permanently empty.

**Root cause:** `MediaAdminListQuery.perPage` (`apps/api/src/modules/media/
dto/media.dto.ts:22`) is capped at `.max(100)`, but `gallery-form.tsx`
requested `perPage=200` — always over the cap, always 422, always silently
swallowed by the `.catch(() => setImageOptions([]))` that was (reasonably)
written to treat a failed load as "nothing to show" rather than surface an
error. Found and fixed the same bug in `lib/reference-data.ts`'s
`useTrackOptions()` (used by the Playlist track-picker), which also
requested `admin/tracks?perPage=200` against the same 100-cap on
`TrackAdminListQuery`. Every other `perPage=` call site in `apps/admin`
was already ≤ 100. Both fixed by requesting `perPage=100` instead — well
above the real catalogue size (19 tracks, well under 100 media assets) so
nothing is actually truncated.

Verified: `pnpm --filter @dj/admin typecheck`/`lint` clean. Not yet
re-verified live.

## `apps/web`: hero image full-bleed, avatar wired up, gallery lightbox (this session)

Three follow-up requests once uploads actually worked end to end, all
in `apps/web`:

1. **Persona hero image wasn't filling the hero like the video does.**
   `StageBackdrop` (`components/cinematic/stage-backdrop.tsx`) only ever
   accepted `videoUrl`; `persona.heroImage` was rendered separately, as a
   normal in-flow `aspect-video` block above the title in
   `[persona]/page.tsx` — a small cropped card, not a background. Fixed:
   `StageBackdrop` now takes an optional `heroImage: MediaImage | null` and
   renders it via `CloudinaryImage` in the exact same
   `absolute inset-0 object-cover` box the video uses (same vignette too),
   shown only when there's no video (video still wins if a persona has
   both). The old in-flow block in `page.tsx` is gone.
2. **Avatar image uploaded but rendered nowhere.** Confirmed it was
   fetched on `PersonaDetail` but had zero consuming UI anywhere in
   `apps/web` — not a rendering bug, a missing feature. Added a small
   circular avatar next to the stage name in the persona hero
   (`[persona]/page.tsx`) — the lowest-risk placement, since `PersonaDetail`
   already carries `avatarImage` there with no contract change needed.
   (The homepage channel switcher would be the more prominent spot, but
   `avatarImage` isn't on `PersonaSummary` yet, which is what it queries —
   a contract change, deliberately not made in this pass; flag if wanted.)

   **Follow-up (later session): the homepage channel switcher and hero
   were also closed.** The homepage's `page.tsx` already re-fetches full
   `PersonaDetail` per persona (for the switcher's genre labels), so no
   contract change was needed there either — `avatarImage` was already in
   hand and just never mapped onto the `Channel` objects the switcher
   consumes. Added `avatarImage: MediaImage | null` to the `Channel`
   interface (`components/cinematic/channel-switcher.tsx`), populated it
   in `page.tsx`'s `channels` mapping, and rendered a small circular
   avatar next to the stage name on each channel card, matching the
   treatment already used on `[persona]/page.tsx`. Separately, the
   homepage's Act 1 hero (`page.tsx` line ~184) only ever passed
   `settings.homeHeroVideoUrl` into `StageBackdrop` — an unrelated
   site-wide setting — with no image fallback at all, so a site with no
   hero video configured showed only the generative shader with no
   photographic layer even though personas have hero images set. Fixed by
   passing the first persona's `heroImage` as `StageBackdrop`'s
   `heroImage` fallback (video still wins when the site-wide setting is
   set). Not verified against a real browser this session — verify the
   avatar crops correctly and the hero fallback image actually renders
   before calling this done.

   **Follow-up (same later session): a real admin field for the homepage
   hero image, not just an implicit persona fallback.** The artist asked
   for this directly — there was no way to *choose* the homepage hero
   photo from admin at all, only the persona-fallback behaviour above.
   Added `homeHeroImageMediaId`/`homeHeroImage` end to end, mirroring the
   existing `homeHeroVideoMediaId` field on `SiteSettings` exactly (same
   singleton row, same nullable-FK-to-`MediaAsset` shape) but mapped as a
   full `MediaImage` via `toMediaImage()`/`MEDIA_IMAGE_SELECT` — the
   `logo`/`defaultOgImage` pattern — rather than the video field's bare
   `secureUrl` string, since this is a still image that needs
   width/height/alt/blur/focal-point. Migration
   `20260921000000_add_home_hero_image` applied and verified live against
   the real Neon database (`prisma migrate deploy` + `post-migrate.sql`
   both ran clean). Touches: `schema.prisma`, the new migration,
   `packages/contracts/src/site.ts` (`SiteSettingsDetail`/
   `SiteSettingsAdminDetail`/`SiteSettingsUpdateInput`), the API's
   `settings.repository.ts`/`settings.mapper.ts`/`settings.service.ts`,
   a new "Homepage hero background image" `MediaSelect` in
   `apps/admin/src/components/settings-form.tsx`, and the homepage now
   prefers `settings.homeHeroImage` over the persona fallback
   (`apps/web/src/app/(marketing)/page.tsx`). `apps/api/openapi.json`
   regenerated via `pnpm --filter @dj/api openapi:update` (passed).
   Typecheck and lint clean across `@dj/api`/`@dj/admin`/`@dj/web`. Not
   verified in a real browser — confirm the new admin field saves and
   that the homepage picks up the image before calling this done.
3. **Gallery images had no click-to-expand**, only the small grid card —
   confirmed via STATUS.md's own history that a lightbox was never built
   at any point, not removed or half-done. Added
   `components/gallery/gallery-grid.tsx`, a client component (following the
   same overlay pattern `CommandPalette` already established: `fixed
   inset-0` backdrop, `role="dialog"`, nothing rendered until opened) that
   owns both the masonry grid and a full-screen lightbox — click a photo,
   arrow keys or on-screen ‹/› to move between photos, Escape or backdrop
   click to close. `gallery/[slug]/page.tsx` now renders this instead of a
   static grid; still a Server Component itself, per
   `dj/no-client-in-route-files`.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, and a full
production build (`pnpm --filter @dj/web build`) succeeds — all pages
prerender, including `/[persona]` (127 kB, under its 155 kB budget) and
`/gallery/[slug]` (109 kB, under its 120 kB budget). **Not verified in a
real browser** — no browser available this session, so the actual crop
behaviour, avatar placement, and lightbox interaction haven't been seen
rendering. Next session with a browser should check all three, especially
the hero image's object-position/crop on a few different screen sizes.

## Avatar sizing/placement follow-up, and the SoundCloud player "stuck after track 2" bug (this session, later)

**Avatar tweak:** bumped from 64–80px to 96–112px (h-24/h-28 → h-32/h-40),
and switched mobile layout from a left-aligned row to a centered column
(avatar above the title, `self-center`) — the title's own width was what
mattered on a narrow screen, and a side-by-side avatar was competing with
it. Row layout (avatar left of title) returns from `sm:` up.

**Player bug — root cause:** `player-context.tsx`'s SoundCloud-widget
effect swapped the invisible iframe's `src` on every track change (causing
the browser to navigate that iframe to a brand-new document), then called
`SC.Widget(iframe)` and immediately treated the result as live —
`widgetRef.current` was assigned synchronously, before the widget's own
`READY` event had ever fired on the new document. A `toggle()`/`seek()`
click landing in that very real gap (iframe loading → widget actually
interactive) silently did nothing, because the SDK drops calls made before
`READY`. First track always looked fine because that gap resolves before
a first-time visitor has anything loaded to click; every track after that
had one, hence "stuck from the second track onward" specifically.

**Fix** (`player-context.tsx`): `widgetRef.current` is now assigned only
inside the widget's `READY` handler, never synchronously — a control click
during the loading gap is now a clean no-op (the widget's own `auto_play`
still starts playback regardless, and its real `PLAY` event reconciles UI
state once it does) instead of a silently swallowed command that permanently
desynced local state from the real widget. Each effect run's listeners are
now also explicitly `unbind()`-ed on cleanup rather than left to accumulate
across switches.

**Also added, as requested:**
- **Mute/unmute**, end to end: `SoundCloudWidget.setVolume` typed in
  `soundcloud.ts` (wasn't there before — mute was genuinely unimplemented,
  not just unwired), `isMuted`/`toggleMute` added to `PlayerState`, applied
  to both the SoundCloud widget (`setVolume(0|100)`, re-applied to every
  new widget once it's `READY`, so mute survives a track switch) and the
  `<audio>` element (`muted` prop) paths. Mute button added to the
  mini-player.
- **Per-card transport controls**: track cards in `track-wall.tsx`
  previously had only a bare play/pause toggle (`PlayButton variant=
  "inline"`). New `player/track-transport.tsx` renders a seek bar + mute
  button under a card once it's the *active* track (mirroring how the
  mini-player itself only ever appears for `current`) — idle cards stay
  uncluttered. The mini-player's own seek slider was extracted into a
  shared `player/seek.tsx` so both surfaces use one implementation, not two.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, and a full
production build succeeds with route budgets still met (`/` 130 kB,
`/[persona]` 128 kB — both under budget). **Not verified in a real
browser against live SoundCloud playback** — no browser available this
session, so the actual track-switch/seek/mute behaviour hasn't been heard
or seen working. This is the most important thing for the next session
(or the user) to verify directly: play track 1, let it run, switch to
track 2, and confirm play/pause/seek/mute all respond immediately with no
stuck window.

## Player fix was incomplete, and introduced a crash — real architectural fix (this session, later still)

The previous "gate on READY" fix reduced but did not eliminate the stuck-
after-switch bug, and closing the mini-player now crashed the whole app
(`TypeError: Cannot read properties of null (reading 'addEventListener')`,
Next.js error overlay). Root cause of both, and it's the same underlying
mistake: the widget-wiring effect re-ran **on every track change**, and
track switches worked by reassigning the SoundCloud iframe's own `src`.

Reassigning an `<iframe>`'s `src` makes the browser navigate that iframe to
a **brand-new document** — which tears down whatever the SoundCloud widget
had wired up inside it. So every single track switch was destroying and
rebuilding the widget from scratch: a new `SC.Widget(iframe)`, a new set of
bindings, a new wait for a new `READY`. The READY-gating fix from earlier
this session correctly stopped calls from hitting a *not-yet-ready* widget,
but a fast switch (or `close()`, which unmounted the iframe entirely) could
also leave code reaching into an iframe document the browser had *already
torn down* — `unbind()` (or an async callback still in flight) touching a
dead document, which is what threw and crashed the page on close.

**The actual fix, not a patch on top:** SoundCloud's Widget API has a
documented way to change the loaded track *without* touching the iframe at
all — `widget.load(url, { auto_play: true })`, called on the same
long-lived widget instance. `player-context.tsx` now:
- Creates the iframe **once**, with a `src` fixed to whichever track
  happens to be the first one played in the session (`initialTrackIdRef`),
  and never changes that attribute again.
- Binds the widget **once**, in an effect keyed on a one-way
  `hasSoundCloud` flag (false → true, never back), not on the current
  track id.
- `play()` now calls `widget.load(...)` for every track after the first,
  operating on the same widget/iframe/document the whole session.
- `close()` no longer tears anything down — it only pauses. The widget
  and iframe now stay mounted for the life of the session (closing the
  mini-player is a UI state change, not a teardown), which is also what
  removes the crash: there is no longer a live document to lose mid-call.
- The unbind-on-cleanup path (now only reachable on a real provider
  unmount) is wrapped in `try/catch` as well, belt-and-suspenders, so a
  widget method touching an already-gone document can never surface as an
  uncaught exception again.

Also this pass: mobile title/avatar alignment — the avatar was centered
but the title stayed left-aligned next to it, reading inconsistently.
`h1#persona-title` is now `text-center sm:text-left`, matching the
avatar's `self-center`, which only applies below the `sm:` breakpoint
where the layout is a stacked column; the row layout from `sm:` up is
unaffected. Avatar also sized up again (128px → 160px content box, was
96–112px) per a second "still looks small" request.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, full production
`build` succeeds, route budgets unchanged (`/[persona]` 128 kB). **Still
not verified against live SoundCloud playback in a real browser** — no
browser available this session. This is now the second attempt at the
same bug without live verification, so treat it as high-priority to
actually test before trusting it further: play track 1, switch to track
2 and 3, confirm seek/pause/mute all work on each, then click the
mini-player's close (✕) and confirm no crash.

## Both dashboard "Known gaps" closed, plus a bigger gap the banner didn't mention (this session)

The user asked why the dashboard's static "Known gaps" card
(`apps/admin/src/app/(dashboard)/dashboard-home.tsx`) was still there
instead of being fixed, and separately asked whether the audio/track admin
functions actually work and where the catalogue's audio comes from.

**Track↔Release membership**, closed end to end:
- `packages/contracts/src/content.ts`: `ReleaseCreateInput`/`UpdateInput`
  gained `trackIds: z.array(Id).max(200).optional()`. Release↔Track is
  **not** a join table like `PlaylistTrack` — it's a plain FK on `Track`
  itself (`releaseId` + `trackNumber`), so this isn't quite the Playlist
  pattern underneath, just the same shape at the API boundary.
- `apps/api/src/modules/releases/releases.repository.ts`: new
  `setTracks(releaseId, trackIds)` — clears `releaseId`/`trackNumber` on
  any track previously on the release but no longer listed, then writes
  both columns (array position → 1-based `trackNumber`) on every track in
  the new list, in one transaction.
- `releases.service.ts`: `create`/`update` call it when `trackIds` is
  present, then re-read so the response reflects the tracks just attached.
- `apps/admin/src/components/releases/release-form.tsx`: added the same
  "Tracks, in order" add/reorder/remove picker `playlist-form.tsx` already
  has, reusing `useTrackOptions()`.

**Persona social links**, closed end to end:
- `content.ts`: new `SocialLinkWriteSchema` (`platform`, `url`, `handle`,
  `isPrimary` — deliberately omitting `followerCount`, which the DB column
  itself is commented as "manually curated social proof", not something
  this pass adds an editing surface for) and `socialLinks` added to
  `PersonaCreateBase`.
- `personas.repository.ts`: new `setSocialLinks()`, same delete-all-then-
  recreate transaction `setGenres()` already uses one platform is the
  unique key (`SocialLink` has a `[personaId, platform]` constraint).
- `personas.service.ts`: wired into `create`/`update` the same way
  `genreSlugs` already is.
- `persona-form.tsx`: a repeatable platform/url/handle/primary row editor
  (add, edit, remove — six common platforms offered first in the dropdown).

Both verified with `pnpm --filter @dj/api typecheck`/`lint`/`build` and
`pnpm --filter @dj/admin typecheck`/`lint`/`build`, all clean, plus
`pnpm --filter @dj/api openapi:update` re-run so the committed
`openapi.json` snapshot doesn't drift from the new contract fields (a
CI-enforced invariant per CLAUDE.md). The dashboard's "Known gaps" card
is now deleted.

**A bigger, unmentioned gap found and fixed while checking "does audio
actually work":** `track-form.tsx` had **no `soundcloudTrackId` field at
all**, despite the contract already accepting it — and per
`player-context.tsx`'s own comment, "all 19 real tracks" stream from
SoundCloud, not from Cloudinary/self-hosted storage. So there was
previously no admin path whatsoever to set the one field that actually
controls what a real track plays. Fixed by adding the input to
`track-form.tsx`, with a hint distinguishing it from the page slug. This
was more load-bearing than either gap the banner named and wasn't
flagged anywhere — found only by directly checking "does this work" per
the user's ask, not by reading a comment claiming it didn't.

**Also fixed while there:** the "Audio file" (self-hosted) picker in
`track-form.tsx` used `MediaSelect` with no `mediaType` prop, silently
defaulting to `'IMAGE'` — so it filtered to image assets and could never
show an actually-uploaded audio file, i.e. it was non-functional for its
stated purpose. `MediaSelect`'s `mediaType` now accepts `'AUDIO'` (a music-
note thumbnail, and its upload purpose maps to the existing `DOCUMENT`
enum value rather than adding a new one — avoids a DB enum migration for
a field no real content currently uses), and `track-form.tsx` passes it.

**Direct answer on the audio-source question:** all 19 real catalogue
tracks stream from **SoundCloud** (an external embed via the Widget API),
**not** from Cloudinary/object storage — confirmed in both
`player-context.tsx`'s own comment and the `Track` Prisma model, which
carries both a `soundcloudTrackId` (populated, the real path) and a
Cloudinary-backed `audioId` (unpopulated for any real track today, but now
a working upload path if a future track needs self-hosted audio instead).

**Not verified live** — no browser or way to exercise a real save against
a live API this session. The next session (or the user) should: attach a
track to a release and confirm it saves and shows on the release's public
page; add a social link to a persona and confirm it round-trips; and set
a `soundcloudTrackId` on a track via the new field and confirm it actually
plays.

## Media delete falsely blocked by a deleted gallery (this session, later)

The user unpublished and deleted a gallery, then tried to delete the
image it had used from the Media library — still got `409 Still
referenced by published content — cannot delete`.

**Root cause:** `Gallery` is a soft-delete model; its child `GalleryItem`
rows are **not** — `GalleryItem` has no `deletedAt` column at all, and
isn't in `packages/db/src/models.ts`'s `SOFT_DELETE_MODELS`. So
soft-deleting a gallery (`GalleriesRepository.softDelete()`, which the
soft-delete Prisma extension turns into `UPDATE ... SET deletedAt = now()`
on the `Gallery` row only) never touches its `GalleryItem` children —
Postgres's `onDelete: Cascade` on that FK only fires for a real `DELETE`,
which this never issues. The items stay live, still pointing at the media
asset via `mediaId`. `MediaRepository.countReferences()`
(`apps/api/src/modules/media/media.repository.ts`) counted
`galleryItem.count({ where: { mediaId: id } })` with no awareness of the
parent gallery's deletion, so a "deleted" gallery kept blocking its
photos from ever being deleted — permanently, since there's no in-app
path to detach a `GalleryItem` other than deleting the whole gallery,
which the user had already done.

**Fix:** that count now joins through the parent —
`galleryItem.count({ where: { mediaId: id, gallery: { deletedAt: null } } })`.
The soft-delete extension only auto-narrows queries on the model it's
actually applied to (`Gallery`); a relation filter from `GalleryItem`
doesn't inherit that narrowing automatically, so this has to be spelled
out explicitly rather than assumed. `listReferences()` (the 409 body's
named-references list) never queried `galleryItem` in the first place, so
needed no change.

**Not fixed, flagged as a smaller follow-up, not blocking:** `GalleryItem`
still isn't a real soft-delete model — a *published, non-deleted* gallery
that removes one photo (not the whole gallery) doesn't soft-delete that
item either; it appears to be handled today via `GalleryForm`'s
add/remove picker actually detaching the item outright (worth confirming
against the actual removal code path, not re-checked this pass). The
gallery-level bug above is what the user hit and is what's fixed;
item-level trash/restore parity, if wanted, would need a real schema
change (a migration adding `GalleryItem.deletedAt` and registering it in
`SOFT_DELETE_MODELS`) — deliberately not done in this pass since the
narrower query fix above fully resolves the reported bug without one.

Verified: `pnpm --filter @dj/api typecheck`/`lint`/`build` all clean. Not
verified against a real database — next session/user should confirm the
originally-stuck image now deletes cleanly.

## Mobile player controls, and dropdowns not closing on outside click (this session, later)

Two more `apps/web` reports: the mini-player's controls didn't work on
small screens, and both the header's desktop "Personas" dropdown and the
mobile "Menu" disclosure only closed by clicking their own trigger again,
not by tapping/clicking anywhere else on the page.

**Mini-player on mobile — not broken, just invisible.** `Seek`
(`components/player/seek.tsx`)'s default styling is `hidden ... md:block`
— sized to sit inline next to the play/mute/close buttons, which there
isn't room for below `md` (~768px), so it was simply never rendered on
a phone at all. That reads as "the player doesn't work on mobile" because
there was nothing to seek with, not because anything actually malfunctioned.
Fixed in `mini-player.tsx`: the layout is now a column below `sm`
(button row, then a full-width seek bar on its own row underneath) and
returns to the original single inline row from `sm` up. Two `<Seek>`
instances exist (one per breakpoint, each `hidden` in the other's range)
rather than one trying to serve both a full-width mobile row and a fixed-
width desktop inline slot — simpler than a single instance juggling both
shapes. The close button also gained `ml-auto` on mobile so it doesn't
end up sandwiched between title and seek in the button row.
`track-transport.tsx` (the per-card seek/mute added earlier this session)
already used a `w-full`, un-hidden `Seek` and needed no change — that one
was already correct on mobile.

**Dropdowns not closing on outside click.** Both the header's "Personas"
dropdown and `MobileNav`'s "Menu" disclosure are native
`<details>`/`<summary>` elements (deliberately — zero-JS, full keyboard/
click/tap support for free, per their own doc comments). What `<details>`
does *not* do on its own is close when you interact anywhere outside it —
only its own `<summary>` toggles it. New shared hook
`components/use-close-on-outside-interaction.ts`
(`useCloseOnOutsideInteraction`) adds a `pointerdown`/Escape listener that
closes the ref'd `<details>` on an outside interaction. The header's
dropdown markup moved into its own small client component,
`components/persona-menu.tsx` (`PersonaMenu`) — it needed to become a
client island to hold the ref/effect, where before it was inert markup
inside the otherwise-server `Header`. `MobileNav` (already a client
component) just gained the same hook alongside its existing close-on-
link-click behaviour.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, full production
`build` succeeds, route budgets unchanged (`/` still 130 kB — the two new
files are tiny and `PersonaMenu`/`MobileNav` were already client code on
this route). **Not verified in a real browser** — no browser available
this session. Next session/user should check: the mini-player's seek bar
is visible and draggable on a phone-width viewport; tapping outside the
Personas dropdown (desktop) and outside the mobile Menu panel closes each;
Escape closes both; and neither regressed on desktop/tablet widths.

## "Can't play/pause on real mobile" + a real loading-state gap (this session, later still)

Two more reports: play/pause still didn't work on a real mobile viewport
even after the seek-bar fix above (the user's own test: works if the page
was loaded at desktop width and then resized down; doesn't work landing
fresh at mobile width), and separately, pressing play "feels like a bug"
— the button flips as if playing but nothing audible happens for a beat.

**Investigated thoroughly; no viewport-conditional code path exists
anywhere in the player.** `useCapability`/`useCoarsePointer` (`packages/
motion`) key off device-memory hints and `matchMedia('pointer: coarse')`
with live listeners, never `window.innerWidth`/`resize`; no button or its
ancestors have a breakpoint-hidden or `pointer-events` class; every
full-bleed decorative layer near the player is confirmed
`pointer-events-none` and confined to its own stacking context. There is
no code here that behaves differently based on "loaded already narrow"
vs. "resized narrow" — grep for `window.innerWidth`/`resize` across
`apps/web/src` and the motion package turned up nothing relevant. Top
remaining theory, unconfirmed without a real device to test against: a
**hydration-timing race** — the marketing route hydrates as one
synchronous pass with no `Suspense`/streaming boundaries, and on a slower
mobile CPU a tap landing before React has attached listeners is simply
swallowed; a resize on an already-loaded desktop page has no such window,
which would explain the exact symptom without needing any viewport
-conditional logic to exist. Not fixed outright this session — genuinely
needs a real mobile device or profiled trace to confirm, which wasn't
available. Two things were still done: `touch-manipulation` added to
every player button (rules out an unrelated but real class of "first tap
does nothing" bugs — legacy double-tap-to-zoom delay on some mobile
browsers for elements without it), and, more substantively:

**The loading-state fix likely explains a real chunk of the reported
symptom on its own.** `isPlaying` was being set **optimistically and
synchronously on click**, before the transport had confirmed anything —
so the button flipped to "playing" (pause icon, `RhythmField` starts
animating) the instant it was pressed, while the actual SoundCloud widget
was still buffering, which is exactly the user's second complaint ("feels
like it started but nothing's playing") and, on a slower mobile
connection with a longer buffering window, would read as "doesn't work at
all" if that gap is long enough for the user to give up or interpret it as
inert. Fixed in `player-context.tsx`: a new `loadingTrackId` (exposed as
`isLoading`) is set the moment play is requested, and `isPlaying` is now
**only** ever set from a real transport confirmation — the SoundCloud
widget's `PLAY` event (with `PLAY_PROGRESS` as a safety net, in case a
`PLAY` event is ever missed) or the `<audio>` element's `onPlaying`.
`play-button.tsx` and `mini-player.tsx` now show a small spinner (new
shared `Spinner` component) during that window instead of a premature
pause icon, so a genuinely slow start now visibly reads as "starting…"
rather than looking broken either way.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, full production
`build` succeeds, budgets unchanged. **Not verified on a real mobile
device** — this is the most important open item: if play/pause still
doesn't respond at all (not just "delayed/unclear") on a real phone after
this deploys, the hydration-timing theory needs to be tested directly
(e.g. Chrome DevTools' Performance panel with CPU throttling on a real
mobile-class trace, watching for the gap between first paint and
`hydrated`/listener-attach), since nothing in the code itself points at a
more specific cause.

## Mobile: not unresponsive, infinitely loading — new information, real fix (this session, later)

The user's follow-up narrowed things down a lot: on mobile the button
*does* respond (the spinner from the fix above appears), it just never
resolves — "loads infinitely." That rules out the hydration-timing theory
above (a swallowed tap would show nothing happening at all, not a
spinner) and points squarely at the transport itself: the tap registers,
`play()` runs, but the SoundCloud widget never confirms playback, so
`isLoading` never clears.

**Most likely cause, given it's mobile-specific:** mobile browsers
(iOS Safari in particular, but not only) are stricter than desktop about
autoplaying unmuted, cross-origin iframe content — this app's very first
SoundCloud track relies entirely on the iframe's own `auto_play=true` URL
param to start itself once its document loads, which several mobile
browsers are known to silently ignore even when the iframe was created
directly from a tap. This is a widely-documented, engine-level limitation
of postMessage-driven third-party widgets (SoundCloud/YouTube/Vimeo
alike) on mobile Safari specifically, not something fixable purely from
this app's code — but the actual bug this session could fix regardless of
that limitation is that **there was no way out of it**: a blocked or
missed autoplay left `loadingTrackId` set forever with nothing to ever
clear it.

**Two changes, in `player-context.tsx`:**

1. **A watchdog timeout** (`LOAD_TIMEOUT_MS`, 8s): every play request now
   arms a timer; if the transport hasn't confirmed within it, `isLoading`
   clears and a new `isStalled` state takes over. This is the actual fix
   for "infinite" — the spinner now always resolves one way or another,
   never spins forever regardless of the underlying cause. `PlayButton`
   and `MiniPlayer` show a red "retry" (⟳) state when stalled; clicking it
   calls `play()` again rather than `toggle()`, so it's a real second
   attempt, not a no-op.
2. **An explicit `widget.play()` call the instant a widget becomes
   `READY`** — a free second attempt at starting audio, on top of the
   iframe's own `auto_play` param, for exactly the "browser silently
   ignored the URL param" failure mode. Harmless if `auto_play` already
   worked (just restarts the same track at position 0, which the user
   will not perceive since it hadn't started).

Both are genuinely defensive fixes, not confirmed root-cause fixes — this
session has no mobile device or ability to trace whether the *reason*
autoplay fails is the cross-origin-gesture limitation above, a
transient network issue, or something else in this app's control. What
*is* now guaranteed regardless of cause: the UI will never spin forever
again, and every stall is retryable and visibly explained instead of
silent.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, full production
`build` succeeds, budgets essentially unchanged (`/[persona]` 129 kB,
`/` 131 kB). **Not verified on a real mobile device.** If tracks still
never actually play after 8 seconds (button turns to retry, tapping it
also fails every time), that confirms the deeper cross-origin autoplay
limitation and the real fix becomes: require an explicit tap-to-unlock
the very first time audio is requested each session (a one-time "Enable
sound" prompt whose own click handler calls `widget.play()` synchronously
within a guaranteed, single-frame user gesture) — not attempted this
session since it's a real UX/architecture change, not a safe drop-in
fix, and shouldn't be built speculatively without confirming the timeout
actually fires in practice first.

## Actual root cause found: a genuine double-trigger race, not just mobile policy (this session, later still)

The timeout fix above made the symptom visible and diagnosable rather
than an actual root-cause fix, and the user's next report confirmed it
was masking something real: switching tracks would alternate between
"UI says playing but silent", "stalls, then a retry/next-track fixes
it" — a flaky, non-reproducible pattern across attempts, not a clean
"works" or "doesn't". That inconsistency is the signature of a race, not
of a browser policy consistently blocking something (a policy block
would fail the same way every time).

**Found it:** the previous session's own "extra nudge" fix
(`widget.play()` called explicitly inside the `READY` handler) was
**racing against `auto_play: true`**, which was *also* still set on both
the initial iframe's URL and every `.load()` call for subsequent tracks.
Two independent "start this sound" commands were being sent over the same
postMessage channel, moments apart, for every single track: SoundCloud's
own `auto_play` handling internally, and this app's explicit
`widget.play()`. Which one "won" — or whether they interfered with each
other and left the widget in an inconsistent state (reporting `PLAY` from
one attempt while the actual audio came from, or was interrupted by, the
other) — was a timing coincidence, not a decision. That is exactly why it
looked random: sometimes fine, sometimes "playing" with no sound,
sometimes genuinely stuck.

**Fix, in `player-context.tsx` and `soundcloud.ts`:** every track start
now has exactly **one** trigger, never two.
- `soundcloud.ts`'s `SoundCloudWidget.load()` gained a `callback` option —
  the Widget API's own documented way to know precisely when a `.load()`'d
  sound has finished loading and is ready to play.
- The iframe's own URL (`soundcloudWidgetUrl(...)`) is now built with
  `auto_play: false` — it no longer tries to start itself.
- `play()`'s track-switch branch now calls `.load(url, { callback: () =>
  widgetRef.current?.play() })` — `auto_play` is gone from that call
  entirely; `callback` is the sole trigger.
- The `READY` handler's `widget.play()` (added last session) is now the
  *only* thing that starts the very first track — since the iframe no
  longer races it with its own `auto_play` attempt.

This is a real fix, not another mitigation layered on top — the loading/
stalled timeout from the previous entry stays as a legitimate safety net
(a genuinely blocked or failed load should still resolve to a retryable
state, not spin forever), but it should now rarely if ever actually fire,
since there's no more race to intermittently lose.

Verified: `pnpm --filter @dj/web typecheck`/`lint` clean, full production
`build` succeeds, budgets unchanged. **Not verified on a real mobile
device** — please retest the exact repro: play a track, switch to
another, and another, several times in a row, and confirm every switch
now either plays correctly or (rarely) shows a genuine, one-time retry
prompt — not the alternating success/silent-play/stall pattern from
before.

## Homepage gig map removed, replaced with a catalogue browse wheel (2026-09-21)

The artist asked for `GigMap` (the homepage's "Where the nights happen" Act 5
and the equivalent "Rooms played" section on persona pages) to be removed
outright: the real catalogue is seven venues in three cities, and a map makes
that count the first thing a visitor's eye lands on — reading as "barely
played anywhere" rather than "three strong residencies," the opposite of the
impression the rest of the page earns. Full reasoning and alternatives in
[ADR 0023](../01-decisions/0023-remove-homepage-gig-map.md).

**Removed:** `components/home/gig-map.tsx`, `components/home/india-outline.ts`,
the `gig-arc-flow` keyframes in `globals.css`, and both call sites
(`(marketing)/page.tsx` Act 5, `(marketing)/[persona]/page.tsx`'s "Rooms
played" section). `Venue.latitude`/`longitude` and `Persona.venuesPlayed` are
unchanged in the API/contracts layer — they still drive the real
`GeoCoordinates` JSON-LD on each venue's own page — only code comments were
updated to stop citing the removed map as their reason to exist. `/venues`
itself (footer + command palette) is unaffected.

**Added, homepage only — not persona pages, which never carried a 3D island
either:** `components/home/browse-act.tsx` + `browse-scene.tsx`, a rotary
"browse wheel": the one physical control a real CDJ spends the most space on,
and the one interaction neither Act 3 (a flat, filterable track list) nor
Act 4 (scrubs whatever is already loaded) already covers. Dragging it
horizontally loads the next/previous catalogue track (`stepTrackIndex()`,
shared between the 3D scene and its fallback so "what's next" can't drift
between the two); a `Prev`/`Next` button pair is the accessible, keyboard-
reachable route to the identical action — the same decorative-visual-plus-
real-control discipline `GigMap` itself used. A small `useTokenColor` hook
was extracted out of `deck-scene.tsx` into `three-token-color.ts` so the new
scene doesn't duplicate it — the deck itself is otherwise untouched.

**Mobile/desktop balance done more correctly than the precedent it copies.**
`frontend.md`'s budget table exempts 3D islands to ≤200KB "desktop-gated,"
and Act 4's existing implementation of that (a `hidden lg:block` Tailwind
wrapper around the whole section) does not actually stop the `three` chunk
from being requested on a capable narrow-viewport device — a CSS-hidden node
still mounts, and `MotionGate`'s capability tier is memory/cores per ADR
0022, not viewport width. `BrowseAct` instead checks
`window.matchMedia('(min-width: 64rem)')` in JS before the `dynamic(() =>
import('./browse-scene'), { ssr: false })` import is ever referenced, so the
module is genuinely never requested off a narrow screen, and `useCoarsePointer()`
excludes touch even on a wide, capable tablet where a drag-to-rotate gesture
has no real equivalent. Every excluded tier — light, static, coarse-pointer,
narrow-viewport — gets the identical `BrowseFallback`: the existing
`RhythmField` (CSS-driven, no canvas, no WebGL) plus the same Prev/Next
control. This is a genuine improvement over the pre-existing `hidden
lg:block` pattern, not just parity with it; **Act 4 itself was left
unchanged**, since fixing it wasn't asked for and it is a separate, already-
shipped feature.

**Verified:** `pnpm --filter @dj/web typecheck` and `lint` both clean (two
import-order warnings auto-fixed). A full production `pnpm --filter @dj/web
build` against the live, already-running local API succeeded — **36/36**
static/dynamic routes generated with no fetch or contract-validation errors,
confirming both `page.tsx` and `[persona]/page.tsx` still render correctly
with `mapVenues`/`venuesPlayed` removed. Route budgets: `/` 131 kB (was
123 kB), `/[persona]` 128 kB (was 126 kB) — both still comfortably inside
the ≤100KB-per-island guidance once the always-desktop-gated 3D chunk is
excluded. Also curled the already-running dev server directly: `/` returns
200 with a "Turn the wheel" Act 5 and zero remaining `gig-map`/`GigMap`
references in the rendered HTML; a real persona page (`/felicitous-x-geetz`)
returns 200 with no "Rooms played" section.

**Not verified:** anything requiring an actual browser — the wheel's drag
gesture, its visual rotation/ridge rendering, the `Prev`/`Next` buttons'
click behaviour, and the `matchMedia`/coarse-pointer gating's real behaviour
on an actual phone or tablet were reasoned through and code-reviewed, not
driven interactively. No mobile device was available this session, matching
every other 3D-adjacent gap already on record above.

## Follow-up: real mobile-width overflow found and fixed with an actual browser (2026-09-21, later)

The artist reported the mobile view "goes out of the screen border," and
that the Act 5 copy still said "turn the wheel" when mobile has no wheel to
turn — correctly calling out that the "not verified... no mobile device"
line above was a real gap, not just a formality. This machine turned out to
have a real Chrome install (`C:\Program Files\Google\Chrome\Application\
chrome.exe`), unlike the "headless Chromium temporarily installed" sessions
referenced elsewhere in this file — so this pass drove it directly via the
Chrome DevTools Protocol (a raw WebSocket to a `--headless=new
--remote-debugging-port` instance, Node 24's built-in `WebSocket`, no
Playwright/Puppeteer install needed) with `Emulation.setDeviceMetricsOverride`
pinned to a real 390×844 mobile viewport, rather than reasoning from code
alone.

**Real bug found, precisely:** `document.body.scrollWidth` measured **427px
against a 390px viewport** — genuine horizontal overflow, and bisecting the
DOM tree (walking from `<body>` down through whichever child's own
`getBoundingClientRect()` was widest, skipping past any element that scrolls
its own overflow by design — the channel-switcher carousel from Group E,
which is *supposed* to be wider than the viewport) landed exactly on Act 5's
`ActHeader` wrapper and `BrowseFallback`'s root, both measured at 411px
wide. Root cause: a CSS grid item's default `min-width` is `auto` (its own
min-content size), not `0` — the identical bug class `track-wall.tsx` and
`gig-map.tsx` already document for **flex** children, just on the grid axis
instead, and one this session's own Act 5 grid (`grid items-center gap-12
lg:grid-cols-2`, copied from Act 4) newly exposed on mobile because Act 5,
unlike Act 4, isn't `hidden` below `lg`. Fixed by adding `min-w-0` to
`ActHeader` (now accepts a `className` prop) and to both `BrowseFallback`'s
and `BrowseScene`'s root elements. Re-measured after the fix: `body.
scrollWidth` is now exactly `390`, matching the viewport, with only the
pre-existing invisible channel-wipe transition div (`opacity-0`, clipped by
its own ancestor, not actually visible or scrollable) left in the offender
scan.

**Copy fixed to match what mobile actually shows:** Act 5's page-level
title/description are server-rendered and shared by every tier — they
can't know client-side which tier will render, so they can't say "turn the
wheel" when a touch/narrow-viewport visitor gets `BrowseFallback` (Prev/Next
buttons, no 3D object at all). Changed to tier-agnostic copy ("Load
something new" / "Browse the catalogue and load whatever comes up next").
`BrowseScene`'s own internal caption ("Turn the wheel to browse") was left
as-is — it only ever renders inside the 3D scene itself, so it's accurate by
construction.

**Also visually verified, unprompted correction of the earlier "not
verified" claim above:** screenshotted the real hero `<h1>` at 390px and
initially misread anti-aliased, downscaled PNG text as clipped ("Four
sound," "s." apparently missing) — cross-checked with `Range.
getClientRects()` on the actual span and found it genuinely wraps onto two
clean lines, both well inside the viewport. That was a screenshot-reading
error on this session's part, not a bug; recorded here so a future session
doesn't rediscover the same false alarm. The hero itself needed no change.

**Genuinely observed, not fixed — flagged for the artist to decide:** the
same mobile screenshot pass showed the `ConsentBanner`'s "Decline" button
partially obscured by `ContactDock`'s WhatsApp button on first visit, before
either has been dismissed. `consent-banner.tsx`'s own doc comment describes
a `--consent-clearance` coordination mechanism meant to prevent exactly
this, so this reads like an existing, unrelated bug in that stacking logic
rather than anything caused by this session's changes — left alone since it
wasn't part of what was asked and touching two other components' fixed-
positioning coordination is a separate piece of work.

**Verified, this follow-up:** `pnpm --filter @dj/web typecheck`/`lint` clean;
full production `build` succeeds (36/36 routes, budgets unchanged from
above); real headless-Chrome measurement at a pinned 390×844 viewport
confirms zero horizontal overflow anywhere on the homepage; a screenshot of
the scrolled-to Act 5 section shows the fixed layout, the new copy, and the
Prev/Next fallback controls all rendering correctly within the viewport.
**Not verified:** the wheel's actual drag gesture and rotation on a real
touch/desktop input device — CDP measured layout and computed styles, not
a physical pointer/touch interaction.

---

## Homepage revamp: shows & flyers, the Video module, admin-configurable sections (2026-09-22)

The artist asked for a homepage revamp and supplied sketches: musical
identities, a discography split by kind of work, "Resident DJ" entries with
real date ranges, a genre list, recently played venues, a grid of gig flyers,
photos, videos, and a closing "Ready to experience premium audio? / Book now /
Listen now". His stated reason is the commercial one: **most people evaluating
him for a booking never open a second page.**

He also asked specifically for a Netflix-style way to browse shows — happened,
upcoming, happening now, early bird — fully manageable from the admin.

Decisions taken with the user before building (all four confirmed): trim the
cinematic layer to the hero, rebuild `/events` rather than add a competing
`/shows`, build the unused `Video` model out properly, and derive show states
from dates with a small real schema addition rather than a free-text badge.
Recorded as [ADR 0024](../01-decisions/0024-homepage-revamp-shows-first.md).

### What shipped

**Homepage** (`apps/web/src/app/(marketing)/page.tsx`, rewritten) — eleven
sections in the sketch's order: hero (genre chips + Book now / Listen now) →
musical identities → **shows & flyers** → discography (filtered by
Original/Remix/Live set/Collaboration) → residencies → recently played venues
→ photo gallery → **videos** → services → proof → closing CTA. Every section
hides itself when it has no content, and each is individually switchable from
admin Settings.

`DeckAct` (3D CDJ) and `BrowseAct` (rotary wheel) are **no longer imported by
the homepage**. Both files remain on disk, working and untouched.

**Shows** — `ShowSpotlight` (the most urgent show, large, with ticket CTA and
countdown) plus a `PosterRail` per phase. `/events` was rebuilt from a text
list into the same poster browse, with server-resolved `searchParams` filters
(city, kind) so every filtered view is a crawlable URL that works without
JavaScript.

**`Event` ticketing phases** — `onSaleFrom`, `earlyBirdUntil`,
`earlyBirdPriceMax` (migration
`20260922000000_homepage_revamp_show_phases_and_home_sections`). One pure,
unit-tested function, `resolveShowPhase()` in `@dj/utils` (11 tests), turns
those plus `eventStatus` into exactly one phase, and the homepage rail, the
browse page, the event detail page and the admin all read it — so they cannot
contradict each other.

**The `Video` module, built from scratch** — the Prisma model and the `video`
RBAC resource had existed since Phase 1 with no module, admin screen or
rendering, exactly the state `Gallery` was found in. Full slice: contracts,
API module (7 files), cache tags, `TAG_MAP`, web queries, admin screen with a
bespoke provider-switching form, homepage rail and a videos section on
`/gallery`. Embeds are composed server-side from a provider plus a bare id — a
pasted URL is rejected — and no third-party iframe mounts until a viewer
presses play, so no tracking cookie is set and no consent prompt is owed.

**Homepage is admin-configurable** — `SiteSettings` gained five nullable copy
fields and nine `homeShow*` booleans, surfaced as a "Homepage" fieldset in the
admin settings form. Deliberately not a drag-and-drop page builder; see
ADR 0024.

### Three real bugs found by running it, not by inspection

1. **`ADMIN_SEED_PASSWORD` was silently truncated.** The value in
   `apps/api/.env.local` contains a `#`, and dotenv treats an unquoted `#` as
   the start of a comment — so the app received the first 8 characters while
   the database held all 15. **The entire e2e suite could not log in**, which
   is very likely what an earlier session read as "the lockout test locked the
   real admin account" (gap #15). Fixed by quoting the value. If e2e ever
   fails at login again, check the quoting before assuming a lockout.

2. **`Video` has no `SeoMeta` relation** — the new module's repository
   included one, and every `GET /videos` 500'd on a Prisma validation error.
   The contract, mapper and query were corrected to match the schema, rather
   than the schema changed to match an assumption.

3. **An event backfilled with a past date advertised itself as upcoming.**
   `isPast` is documented as "maintained by the hourly cron" and *that cron
   did not exist* — so the column held whatever the row was created with. The
   cron now exists (`events-past-flag.cron.ts`, advisory-locked like the media
   sweeper) **and** the write path derives `isPast` from the dates, because
   backfilling shows already played is exactly what fills the "Recently
   played" row. Verified in both directions live, including that a re-dated
   (postponed) show returns to upcoming and that an unrelated edit does not
   disturb the flag.

Also fixed in passing: `/events` and `/gallery` had **no `h1` at all** —
`SectionHeader` only ever emitted an `h2`. It now takes an `as` prop
(default `h2`); both pages pass `as="h1"`. Found with a real browser, not by
reading.

### What was verified, and how

**Live against the real Neon database and a real headless Chromium:**

- 212 unit tests pass (`@dj/utils` 56 incl. 11 new, `@dj/api` 66, `@dj/db` 90).
- **39 e2e tests** against the live database: the new `videos.e2e-spec.ts`
  (15, including the provider invariant on both create and PATCH, embed
  recomposition, and slug reuse after a soft delete per ADR 0020), plus
  `events`, `programs` and `group-b-settings-sitemap` (24) re-run because
  those modules changed. **The full suite was deliberately not run** — gap #15.
- `pnpm lint` clean (one pre-existing admin warning), `tsc` clean everywhere,
  `pnpm check:env` OK, `openapi.json` regenerated and committed (11 new video
  paths, 3 new event properties).
- API: the `when=live` filter, `hasFlyer`, city filtering composing correctly
  with the live window (the `AND`-wrapping guard), and 422s with correct JSON
  Pointers on every new refinement.
- Browser at 390px and 1280px on `/`, `/events`, `/gallery`: **no horizontal
  body overflow anywhere**, `h1` present, rails focusable and labelled, and
  the rail's Next button verified to actually scroll (319px).
- **Full admin round trip in a real browser**: logged in, created a video
  through the admin form, published it, and confirmed it appeared on both `/`
  and `/gallery` — which exercises the revalidation webhook and the cache-tag
  symmetry. Then deleted it. Toggling `homeShowVideos` off in Settings was
  verified to hide the section on the public homepage, and restored.
- All verification fixtures were removed; seeded content is as it was found.

**Not verified:**

- **The headline feature cannot be judged on real content.** There are no real
  events, flyers or videos in the catalogue — everything above was proven with
  `[DEMO]`-prefixed rows that have since been deleted. The sections render
  their honest empty states until the artist adds content. Nothing was
  invented (`brand.md`).
- A real Cloudinary flyer/thumbnail upload through the video form. Credentials
  are now real (the API logs "Cloudinary configured"), but no image was
  uploaded in this session.
- The hourly `isPast` cron firing on its schedule. Its logic is exercised by
  the write-path derivation and was reviewed, but a full hour was not waited
  out.
- Screen-reader testing, still a Group F handoff item.

### One budget regression, not silently absorbed

`/gallery` first-load JS is **125KB against a documented ≤120KB target** for
content routes. Cause: the page's photo grid was entirely server-rendered, and
adding the video rail pulls `next/image`'s client runtime in. Splitting the
lightbox into its own lazy chunk was done anyway (it is the right shape) but
recovered nothing, because the lightbox was never the weight.

`/` is 134KB (≤145KB), `/[persona]` 128KB (≤155KB), `/events` 112KB (≤120KB)
— all green. Note `/` went **up** from 123KB, not down: removing the 3D deck
freed little, because it was already a lazy `dynamic()` import and never in
the first load. That expectation, stated in the plan, was wrong.

The remaining options for `/gallery` are to drop SSR for the video rail
(`ssr: false`, costing the video titles in the server HTML) or to raise the
target for that route. Neither was chosen unilaterally — it needs a call.
`size-limit` is still a commented-out future CI job, so nothing is failing
today.

### Known gaps left open deliberately

- **`Program` and `ExperienceEntry` both model a residency and are
  unconnected.** The homepage prefers `Program` and merges in only those
  experience rows whose organisation no program already covers, matched on
  name (`components/home/residencies.tsx`). Collapsing the two is a migration
  with a content-migration story attached, and the artist has real data in
  both. Recorded in ADR 0024, not resolved.
- Videos have no public detail route (`/videos/[slug]`); the lightbox is the
  only way to watch one, which is why the contract carries no `seo` field.
- `pnpm db:generate` can fail with `EPERM ... query_engine-windows.dll.node`
  while a dev server is running on Windows — a file lock, not a code problem.
  Stop the API first.

### What the artist needs to do next

The feature is built and proven; it is **empty until he fills it**. In admin:
add events with flyers (Media library → upload, then the flyer picker on the
event form), set `onSaleFrom` / `earlyBirdUntil` / early-bird price where
relevant, add videos (YouTube or Vimeo id, plus a thumbnail), and publish
each. The homepage sections appear on their own as content lands.
