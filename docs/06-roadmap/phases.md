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
| 5   | Media pipeline                 | 4 + Cloudinary keys | **B** | ⬜         |
| 6   | Remaining content + engagement | 4 + Resend keys     | **B** | ⬜         |
| 7   | Web shell + data + SEO core    | 4                   | **C** | ⬜         |
| 8   | Conversion (booking funnel)    | 6, 7                | **D** | ⬜         |
| 9   | Media & player                 | 5, 7                | **D** | ⬜         |
| 10  | Cinematic + signature motion   | 9                   | **E** | ⬜         |
| 11  | Admin panel                    | 3, 4, 5, 6          | **E** | ⬜         |
| 12  | Hardening & launch             | all                 | **F** | ⬜         |
| 13  | Growth                         | 12                  | **F** | ⬜         |

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
| **B** | 5+6    | Media + content     | Phase 6's pure-CRUD modules unblocked; rest needs Cloudinary/Resend |
| **C** | 7      | Web shell + SEO     | Needs Group A complete                                              |
| **D** | 8+9    | Conversion + player | —                                                                   |
| **E** | 10+11  | Motion + admin      | —                                                                   |
| **F** | 12+13  | Hardening + growth  | —                                                                   |

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

## Phase 5 — Media pipeline ⬜

Cloudinary module, signed uploads, transformation bootstrap, metadata re-read,
placeholder generation, reference counting, two-phase delete, orphan sweeper.

**Exit:** a browser-signed upload lands in the correct server-decided folder
and produces a `MediaAsset` with correct bytes, dimensions and `blurDataUrl`,
with `t_djf_card` and `t_djf_og` derivatives already present; deleting a
referenced asset 409s **listing the referencing entities**; the sweeper removes
a 31-day-old soft-deleted asset from both database and Cloudinary; a background
video and an audio track both round-trip, the audio with peaks.

## Phase 6 — Remaining content + engagement ⬜

Testimonials, Services, Brands, Stats, FAQ, PressKit, Gear, Experience, Blog,
StaticPages, Settings, Redirects, Sitemap; Inquiries and Newsletter; all email
templates and the retry cron.

**Exit:** submitting the form creates an `INQ-YYYY-NNNN` row, returns 201 in
**<100ms**, and delivers both the notification and the autoresponder;
`GET /sitemap` lists exactly the published indexable URLs; the press-kit PDF
generates and downloads through a signed URL.

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

## Phase 10 — Cinematic + signature motion ⬜

`packages/motion`, `<MotionGate>`, channel switcher, shader backgrounds, 3D
turntable, 3D gig globe, audio visualiser, scroll-driven reveals, Lenis, View
Transitions, command palette, grain.

**Exit:** every item in
[`../03-design-system/motion.md`](../03-design-system/motion.md) ships **with
its documented fallback**; a forced `prefers-reduced-motion` run **and** a
forced `saveData` run each render a complete, beautiful page with ≤60KB JS; INP
≤150ms; no budget regressions.

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
