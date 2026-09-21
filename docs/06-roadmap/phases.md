# Phases

Canonical phase table with exit criteria. For current state, read
[`STATUS.md`](STATUS.md). For full detail, [`masterplan.md`](masterplan.md).

> **Do not skip phases.** The dependencies are real — building Phase 7 before
> Phase 4 means building against an API that does not exist. Exit criteria are
> the definition of "done" for a phase, not a wish list.

| #   | Phase                          | Depends on          | Group | State      |
| --- | ------------------------------ | ------------------- | ----- | ---------- |
| 0   | Foundations                    | —                   | —     | ✅         |
| 1   | Data layer                     | 0                   | —     | ✅         |
| 2   | API skeleton & global concerns | 1                   | **A** | ✅         |
| 3   | Auth & RBAC                    | 2                   | **A** | ✅ (1 gap) |
| 4   | Core content CRUD              | 3                   | **A** | ✅         |
| 5   | Media pipeline                 | 4 + Cloudinary keys | **B** | ✅ (code) / ⬜ (live) |
| 6   | Remaining content + engagement | 4 + Resend keys     | **B** | ✅ (code) / ⬜ (live) |
| 7   | Web shell + data + SEO core    | 4                   | **C** | ✅         |
| 8   | Conversion (booking funnel)    | 6, 7                | **D** | ✅ (scoped) |
| 9   | Media & player                 | 5, 7                | **D** | ✅ (scoped) |
| 10  | Cinematic + signature motion   | 9                   | **E** | ✅ (scoped) |
| 11  | Admin panel                    | 3, 4, 5, 6          | **E** | ✅ (all content types) |
| 12  | Hardening & launch             | all                 | **F** | ✅ (codeable subset) |
| 13  | Growth                         | 12                  | **F** | ✅ (codeable subset) |

---

## Delivery groups

Phases are the unit of _design_; groups are the unit of _delivery_. Phases
within a group are built together in one pass because they share the same
files and the same verification setup — doing them separately means writing
the module skeleton, then reopening every file to add auth, then reopening it
again to add CRUD.

**Grouping changes nothing about scope.** Every phase's exit criteria still
have to be met, and verified together before the group is called done.

| Group | Phases | Theme               | State                                                               |
| ----- | ------ | ------------------- | ------------------------------------------------------------------- |
| **A** | 2+3+4  | Backend foundation  | 2 and 4 done; 3 has one documented gap (auth unit coverage)         |
| **B** | 5+6    | Media + content     | All code written and wired; live Cloudinary/Resend/Turnstile verification blocked on credentials (STATUS.md gap #2) |
| **C** | 7      | Web shell + SEO     | Complete — see STATUS.md                                             |
| **D** | 8+9    | Conversion + player | Complete (scoped) — see STATUS.md                                    |
| **E** | 10+11  | Motion + admin      | Complete — all content types have admin CRUD — see STATUS.md         |
| **F** | 12+13  | Hardening + growth  | Complete (codeable subset) — see STATUS.md's handoff list for the rest |

Group A's one remaining item is listed in [`STATUS.md`](STATUS.md) — the
`auth/` unit-test coverage gap, which does not block Group B or C.

---

## Phase 0 — Foundations ✅

Harvest legacy data, delete `djfelicitous/`, scaffold the workspace, shared
configs, Docker Compose, env examples, CI, `docs/`.

**Exit:** `pnpm install && pnpm turbo lint typecheck build` green on a clean
clone; `docker compose up -d` yields a reachable Postgres.

## Phase 1 — Data layer ✅

48 models, soft-delete and audit extensions, migrations, post-migrate SQL,
three seed layers, integration tests.

**Exit:** migrations apply from empty; seeds produce the documented counts;
integration tests prove soft delete hides rows and that `delete` never issues a
real `DELETE`; `db:migrate:check` reports zero drift.

## Phase 2 — API skeleton & global concerns ✅

NestJS bootstrap, Zod config, Pino + request-id, `/api/v1` versioning, the
guard/filter/interceptor chain, `PrismaModule`, Terminus health, Swagger,
helmet/CORS/compression, graceful shutdown.

**Exit:** `/health/ready` returns 200 with database and Cloudinary checks;
`/api/docs` renders; a deliberately thrown error returns valid
`application/problem+json` carrying a `requestId` that appears in the logs; a
30-second handler is cut off at 15 seconds by the timeout interceptor.

**Met**, except that the 30-second timeout was verified by inspection rather
than by an end-to-end test. Sentry's filter is deferred to Phase 12.

## Phase 3 — Auth & RBAC ✅ (one gap)

argon2id, access + rotating refresh tokens, reuse detection, lockout, TOTP,
RBAC guards and decorators, audit interceptor, CSRF.

**Exit:** the full e2e matrix green — login success/fail/locked, rotation,
**reuse revokes the family**, 2FA plus recovery, every role against every
endpoint class, CSRF rejection. `auth/` at **100% coverage**. An `AuditLog` row
for every auth action.

**Met except coverage.** 36 e2e tests cover the behaviour — no enumeration,
rotation, family revocation on reuse, CSRF, the per-IP limit, and the role
matrix. `TotpService` and `PasswordService` now carry unit tests (~98% lines
each); `AuthService`, `AuthController`, `AuthRepository`,
`RefreshTokenService` and `AuthCookieService` remain unit-untested. Gap #7 in
[`STATUS.md`](STATUS.md), full account in
[ADR 0021](../01-decisions/0021-auth-coverage-gap-and-inert-threshold.md).

## Phase 4 — Core content CRUD ✅

Personas, Genres, Tracks, Playlists, Releases, Events, Venues, Programs, plus a
shared `BaseContentService` implementing publish/unpublish/archive/restore/
reorder.

**Exit:** every resource supports list (cursor + offset, sort, filter, include,
fields), read-by-slug, admin CRUD and the publish workflow;
`GET /personas/:slug/page` returns the complete landing payload in **≤8
queries**; the OpenAPI snapshot is committed.

**Met.** `BaseContentService`, cursor and offset pagination, the include and
sort allowlists, idempotency, ETags, cache-tag revalidation, and **all 8
modules** end to end — Personas and Genres from the prior session, Venues,
Tracks, Releases, Playlists, Programs and Events this one. The aggregate page
endpoint runs in **5 queries**. The OpenAPI snapshot is committed and gated
against drift, and now describes every module's routes. 77 new e2e tests plus
a live app-boot smoke test verified the last six, documented in
[`../02-architecture/backend.md`](../02-architecture/backend.md)
§"Adding a content module".

## Phase 5 — Media pipeline ✅ (code) / ⬜ (live verification)

Cloudinary module, signed uploads, transformation bootstrap, metadata re-read,
placeholder generation, reference counting, two-phase delete, orphan sweeper.

**Exit:** a browser-signed upload lands in the correct server-decided folder
and produces a `MediaAsset` with correct bytes, dimensions and `blurDataUrl`,
with `t_djf_card` and `t_djf_og` derivatives already present; deleting a
referenced asset 409s **listing the referencing entities**; the sweeper removes
a 31-day-old soft-deleted asset from both database and Cloudinary; a background
video and an audio track both round-trip, the audio with peaks.

**Not met as literally written** — every clause needs a real upload against
live Cloudinary credentials, which remain placeholders (STATUS.md gap #2).
What is built and verified: signing (pure local computation, tested), the
confirm/re-read flow's code path (tested to fail as a clean 503 when
unconfigured, not tested against a real Cloudinary response), the reference-
counting delete guard across every FK that can point at a `MediaAsset`, and
the orphan sweeper's `pg_try_advisory_xact_lock` guard. See STATUS.md's
Phase 5 section for the full account.

## Phase 6 — Remaining content + engagement ✅ (code) / ⬜ (live verification)

Testimonials, Services, Brands, Stats, FAQ, PressKit, Gear, Experience, Blog,
StaticPages, Settings, Redirects, Sitemap; Inquiries and Newsletter; all email
templates and the retry cron.

**Exit:** submitting the form creates an `INQ-YYYY-NNNN` row, returns 201 in
**<100ms**, and delivers both the notification and the autoresponder;
`GET /sitemap` lists exactly the published indexable URLs; the press-kit PDF
generates and downloads through a signed URL.

**Partially met.** The pure-CRUD half (Testimonials, Services, Brands, Stats,
FAQ, Gear, Experience, StaticPages, Settings, Redirects, Sitemap, Blog/Tags)
is fully verified against a live database — 37 new e2e tests. The row/
201-in-under-100ms half of the inquiry criterion is verified; actual email
delivery and actual PDF upload are not, for the same reason as Phase 5 (gap
#2). Gallery and Video are deliberately out of scope — see STATUS.md.

## Phase 7 — Web shell + data + SEO core ⬜

Layouts, nav, footer, the fetch wrapper and query modules, the revalidate
webhook, every public route, `generateMetadata`, OG images, sitemaps, robots,
the JSON-LD graph, RSS and iCal.

**Exit:** every route prerendered; **every internal link resolves 200** (link
crawl); Google Rich Results Test **zero errors**; every legacy URL 301s,
verified in e2e; Lighthouse ≥95 with motion off.

## Phase 8 — Conversion ⬜

Booking wizard, server actions, rate limiting, Turnstile, contact fast paths,
thanks page, admin enquiry inbox v1, analytics and consent.

**Exit:** a real enquiry lands in Postgres, sends email, and offers the
WhatsApp handoff; funnel analytics fire; the form passes axe **and** the no-JS
submit test.

## Phase 9 — Media & player ⬜

Cloudinary loader, `SIZES` module, LQIP, hero video strategy, mini player with
precomputed peaks, gallery and video lightboxes, custom video player.

**Exit:** LCP ≤2.0s p75 on `/` and `/[persona]` on throttled mobile; the mini
player survives **five navigations**; the lightbox passes keyboard, gesture and
deep-link tests; `size-limit` gates enforced.

## Phase 10 — Cinematic + signature motion ✅ (shipped; browser verification outstanding)

`packages/motion`, `<MotionGate>`, channel switcher, shader backgrounds, 3D
turntable, 3D gig globe, audio visualiser, scroll-driven reveals, Lenis, View
Transitions, command palette, grain.

**Exit:** every item in
[`../03-design-system/motion.md`](../03-design-system/motion.md) ships **with
its documented fallback**; a forced `prefers-reduced-motion` run **and** a
forced `saveData` run each render a complete, beautiful page with ≤60KB JS; INP
≤150ms; no budget regressions.

**Status:** shipped in the visual-layer session — `packages/motion`, the
three-tier gate, real fonts, the WebGL persona field, the channel switcher,
the nine-act homepage, the persona pages, a procedural 3D deck, scroll-driven
reveals, and a player rebuilt on the SoundCloud Widget API. The generative
direction was forced by there being **no photos, video or fonts in the repo
at all**, and turned out to be the right one. A projected gig map originally
shipped in Act 5 was replaced with a rotary catalogue browse wheel in a later
session — see [ADR 0023](../01-decisions/0023-remove-homepage-gig-map.md).
Budgets measured green (`/` 123 kB, `/[persona]` 126 kB). **Still open:**
View Transitions and the custom cursor, and — the important one — nothing
in this layer has been observed in a real browser, so the `≤60KB JS` and
`INP ≤150ms` halves of this exit criterion are reasoned rather than
measured. See STATUS.md gaps #17–18.

## Phase 11 — Admin panel ⬜

Auth UI, RBAC gating, tables, CRUD for every entity, Tiptap with custom embeds,
media library with crop and focal point, dnd-kit reordering, draft/schedule
with live preview, optimistic updates, audit log, enquiry Kanban.

**Exit:** **the artist publishes a new track, event, playlist and gallery set
end to end with no developer involved, in a recorded usability session**;
publish → live in under 10 seconds; RBAC verified server-side.

This is the exit criterion the whole project is for.

## Phase 12 — Hardening & launch ⬜

Full a11y audit, real screen-reader review, visual regression baselines,
Lighthouse budgets locked, strict CSP, Sentry, legacy 301 map, load test,
restore drill, runbooks, launch, Search Console.

**Exit:** all gates green; **manual NVDA and VoiceOver pass**; Rich Results
clean; 301 map verified; **a completed restore drill**; OG previews checked on
WhatsApp, Instagram and LinkedIn (WhatsApp matters most in India); two-week
Core Web Vitals watch scheduled.

## Phase 13 — Growth ⬜

Location and venue landing pages, blog content engine, `/search`, post-event
testimonial collection, Spotify/SoundCloud play-count sync, i18n activation,
PWA offline press kit, Upstash + BullMQ if triggered, booking-CTA A/B tests.

No exit criteria — this is a backlog, not a phase.
