# DJ Felicitous — Dynamic Portfolio Platform: Masterplan

## Context

`d:\Projects\dj-portfolio\djfelicitous` holds a legacy static Next.js 15 portfolio for **DJ Felicitous**, a Bangalore-based multi-genre DJ/producer operating four artist personas. It is being **discarded, not revamped**. Its concrete failures (all verified by inspection):

- Every page is `'use client'` → **zero SSR**, no per-page `metadata`, no sitemap, no robots.txt, no JSON-LD. The site is effectively invisible to search.
- All content is hardcoded in `src/data/djProfiles.ts` and `src/data/discography.ts` → **the DJ cannot update anything without a developer**. This is the central problem to solve.
- Three conflicting color systems (`globals.css` `:root`, `tailwind.config.ts`, an "executive" Bootstrap-ish palette) across `globals.css` / `globals-new.css` / `globals-backup.css` (870 lines, plus two dead backups).
- Fonts (`Orbitron`) referenced in classes but never loaded → silent fallback. Claimed `font-orbitron` on 2 pages.
- Broken media: all 20 `albumArt` paths point to a non-existent `/images/tracks/` dir; `couple-1.JPG` / `psy5.JPG` case mismatches break on case-sensitive hosts; 33 unoptimized JPG/PNG, no WebP/AVIF, raw `<img>` in places.
- `BookingModal.tsx` (281 lines) only does `console.log` + `alert()` — **every booking inquiry ever submitted was silently discarded**. Budget ranges are in USD for an INR business.
- Dead footer links: `/press`, `/rider`, `/contact`, `/about`, `/collaborate`, `/services/*`, `/privacy`, `/terms` — all 404.
- `viewport: { maximumScale: 1 }` disables pinch-zoom (WCAG violation).
- Fabricated social proof (testimonials attributed to Boom Festival, Ozora, Berghain, Fabric, Tresor) — **must not be carried over**.
- A live-looking `RESEND_API_KEY` committed in `djfelicitous/.env.local`.

**Intended outcome:** a from-scratch, enterprise-grade monorepo — public site + admin CMS + API — where the DJ manages 100% of content himself, the site is genuinely SEO-dominant for Bangalore/India DJ-booking queries, and the frontend is cinematic and interactive enough to convert event organizers, wedding planners, and festival promoters into bookings.

### Confirmed decisions

| Decision      | Choice                                                                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo          | pnpm + Turborepo monorepo, `apps/web` + `apps/admin` + `apps/api` + `packages/*`                                                                                                                                                    |
| Admin         | **Separate app** (`admin.djfelicitous.com`) — zero admin JS/session cookie on the public origin                                                                                                                                     |
| Auth          | **Hand-rolled NestJS**: argon2id + JWT access (15m) + rotating refresh in httpOnly cookie, RBAC, TOTP 2FA                                                                                                                           |
| CMS scope     | **Full schema up front**, admin UI phased                                                                                                                                                                                           |
| API hosting   | **Railway** (persistent container: in-process cron, TCP pooling, in-memory LRU)                                                                                                                                                     |
| Aesthetic     | **Cinematic full-bleed video** — every major section is a full-viewport video/photo with overlaid type; scroll reads as a film sequence                                                                                             |
| Interactivity | **Maximum** — WebGL shaders + audio-reactive visualizer + R3F 3D scenes (turntable, gig globe)                                                                                                                                      |
| Bookings      | DB row + status pipeline + Resend notify/autoresponder + prefilled WhatsApp deep link                                                                                                                                               |
| Extra modules | Blog, Services/packages (INR), Press kit + tech rider, Newsletter + FAQ, **Audio playlists/mixes**, **Venues played**, **Programs/shows performed**, **Work experience timeline**, **Console/gear experience** — all admin-editable |

> **Non-negotiable:** cinematic video + max interactivity must not cost Core Web Vitals. Every heavy experience ships behind a `<MotionGate>` with a server-rendered, beautiful, zero-JS fallback. Budgets in §9 are CI gates, not aspirations.

---

## 1. Deliverables of this plan

1. **`docs/`** — the durable masterplan future Claude Code sessions read before touching anything (§10). Written first.
2. **Scaffolded monorepo** — workspace, Turborepo, shared configs, three apps, seven packages, Docker Compose, CI, `.env.example` files.
3. **Phase 0–1 executed**: foundations green + complete Prisma schema + migrations + seeds.
4. **Legacy data harvested** into `packages/db/seed/data/` before `djfelicitous/` is deleted.
5. **Stop.** No feature implementation beyond Phase 1. No git init, no commits.

---

## 2. Monorepo layout

```
d:\Projects\dj-portfolio\
├─ docs/                          # ← the masterplan (§10). Read this first, always.
├─ .github/workflows/{ci.yml, deploy-api.yml}
├─ docker-compose.yml             # postgres:16 + mailpit + (profile) redis:7
├─ turbo.json  pnpm-workspace.yaml  .npmrc  .nvmrc  package.json
│
├─ apps/
│  ├─ web/     # Next.js 15 public site — Vercel, static+ISR+PPR
│  ├─ admin/   # Next.js 15 CMS — Vercel, force-dynamic, no-store
│  └─ api/     # NestJS 11 — Railway container
│
└─ packages/
   ├─ db/                # @dj/db — owns Prisma schema, migrations, seeds
   ├─ contracts/         # @dj/contracts — Zod SSOT: validation + OpenAPI + FE types + cache tags
   ├─ ui/                # @dj/ui — design tokens + primitives + composites (Storybook)
   ├─ motion/            # @dj/motion — MotionGate, capability detection, variants, easings
   ├─ media/             # @dj/media — Cloudinary loader, sizes presets, LQIP helpers
   ├─ seo/               # @dj/seo — metadata builders, JSON-LD @graph, OG layouts
   ├─ analytics/         # @dj/analytics — consent-gated event bus
   ├─ utils/             # @dj/utils — slugify, formatINR, IST dates
   └─ config-{ts,eslint,tailwind}/
```

`turbo.json`: `globalDependencies: [".env", "packages/db/prisma/schema.prisma"]`; `build` depends on `["^build", "db:generate"]`; `typecheck`/`test` likewise. TypeScript **project references** with `composite: true` from `packages/config-ts/base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).

**Why a separate `apps/admin`:** the public app can be static/ISR end-to-end, which an `/admin` route group quietly poisons via cookie-reading layouts and shared middleware; the session cookie scopes to `admin.` only (large CSRF/XSS blast-radius reduction); admin can pull TanStack Table + Tiptap + Cloudinary widget with zero effect on public LCP.

---

## 3. Backend architecture (`apps/api`, NestJS 11)

### 3.1 Feature-module convention — identical for every module

```
modules/events/
├─ events.module.ts
├─ events.controller.ts          # public reads, @Public(), cacheable
├─ events.admin.controller.ts    # writes, class-level @UseGuards + @RequirePermissions
├─ events.service.ts             # business rules, transaction boundaries, domain events
├─ events.repository.ts          # the ONLY place Prisma is touched for this aggregate
├─ dto/{create,update,query}-event.dto.ts   # createZodDto(...) from @dj/contracts
├─ mappers/event.mapper.ts       # toPublic() / toAdmin(), pure
├─ entities/event.entity.ts      # Swagger response class
└─ __tests__/{*.service.spec.ts, *.repository.int-spec.ts}
```

ESLint-enforced boundaries (`no-restricted-imports`): `PrismaService` only in `*.repository.ts` and `infra/`; controllers never import `@prisma/client`; cross-module access via the other module's **service**, never its repository; `$queryRawUnsafe`/`$executeRawUnsafe` banned.

**Split public/admin controllers** rather than per-route guards — the security boundary becomes structural. The global `JwtAccessGuard` denies by default; `@Public()` opts out. Nothing is protected by accident of omission.

### 3.2 Module inventory

- **Infra/global:** `ConfigModule` (Zod-validated, fail-fast), `LoggerModule` (nestjs-pino + `genReqId` + redaction + AsyncLocalStorage request context), `PrismaModule`, `CacheModule`, `CloudinaryModule`, `MailModule` (Resend + React Email), `RevalidationModule`, `HealthModule` (Terminus), `ThrottlerModule`, `ScheduleModule`, `EventEmitterModule`.
- **Platform:** `AuthModule`, `UsersModule`, `RbacModule`, `AuditModule`.
- **Content:** `PersonasModule`, `GenresModule`, `TracksModule`, `PlaylistsModule`, `ReleasesModule`, `EventsModule`, `VenuesModule`, `ProgramsModule`, `MediaModule`, `GalleriesModule`, `VideosModule`, `TestimonialsModule`, `ServicesModule`, `BrandsModule`, `StatsModule`, `FaqModule`, `PressKitModule`, `GearModule`, `ExperienceModule`, `BlogModule`, `StaticPagesModule`.
- **Engagement:** `InquiriesModule`, `NewsletterModule`.
- **Site:** `SettingsModule`, `SeoModule`, `RedirectsModule`, `SitemapModule`, `AnalyticsModule`.
- **Ops:** `JobsModule`.

### 3.3 Global concerns (`main.ts` + `app.module.ts`)

`main.ts`: `patchNestJsSwagger()`, Pino logger, `trust proxy`, helmet, compression, cookie-parser, `setGlobalPrefix('api', { exclude: ['health*'] })`, `enableVersioning({ type: URI, defaultVersion: '1' })` → `/api/v1/*`, CORS with `credentials: true` + `exposedHeaders: ['ETag','X-Request-Id','X-Total-Count']`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, `enableShutdownHooks()`, `express.json({ limit: '256kb' })`, Swagger at `/api/docs` (off in prod).

`app.module.ts` providers, **in this order** (it is the security boundary):
`APP_GUARD`: ThrottlerGuard → JwtAccessGuard → PermissionsGuard.
`APP_FILTER`: SentryGlobalFilter → PrismaExceptionFilter → AllExceptionsFilter.
`APP_INTERCEPTOR`: RequestContext → Timeout(15s, `@Timeout()` override) → Idempotency → HttpCache → Audit → ClassSerializer.

Throttlers: `short` 30/10s, `medium` 120/60s; `/health` skipped.

### 3.4 Errors — RFC 9457 `application/problem+json`

```jsonc
{
  "type": "https://api.djfelicitous.com/problems/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "instance": "/api/v1/inquiries",
  "requestId": "01JQ8Z...",
  "code": "VALIDATION_FAILED",
  "errors": [
    { "pointer": "/eventDate", "code": "too_small", "message": "Event date must be in the future" },
  ],
}
```

`errors[].pointer` is a JSON Pointer so admin forms map errors to fields mechanically. Prisma mapping: `P2002 → 409` (pointer from `meta.target`), `P2025 → 404`, `P2003 → 409`. Problem `type` URIs resolve to real docs under `/api/docs/problems`.

### 3.5 Auth & authz

- argon2id at OWASP params; `passwordChangedAt` as a global refresh-revocation stamp.
- Access JWT 15m (Bearer, in memory on the client) + **opaque rotating refresh token** (sha256-hashed in `refresh_tokens`, httpOnly/Secure/SameSite=Strict cookie, `Domain=admin.djfelicitous.com`, 30d) with `familyId` lineage — **reuse of a rotated token revokes the entire family** and writes an audit log.
- Endpoints: `login`, `refresh`, `logout`, `logout-all`, `2fa/enroll|verify|disable`, `password/change`, `password/forgot|reset`, `invite/accept`.
- RBAC: `Role`(`SUPER_ADMIN`/`EDITOR`/`VIEWER`) × `Permission`(`resource:action`) with `@RequirePermissions('event:publish')` + `@CurrentUser()` decorators.
- Lockout: per-account (`failedLoginCount`/`lockedUntil`, exponential) **and** per-IP (10 attempts/15min). Identical response body **and timing** for unknown-email vs wrong-password (no user enumeration). Passwords ≥12 chars checked against a local top-10k breached list via `zxcvbn`.
- TOTP 2FA mandatory for `SUPER_ADMIN`; secret AES-256-GCM encrypted at rest; argon2-hashed one-time recovery codes.
- CSRF double-submit token on all cookie-authenticated writes.

**Why hand-rolled over Better Auth / Auth.js / Clerk:** 1–5 admin users, no social login, no multi-tenant. Better Auth and Auth.js are Node/Next-runtime-first and want to own the session tables, fighting Prisma-as-source-of-truth and Nest guards. Clerk adds an external dependency and cost for a single-admin site. The cost here is ~400 LOC, fully covered by tests at 100% coverage.

### 3.6 Media pipeline (Cloudinary)

**Signed direct browser → Cloudinary.** `POST /api/v1/media/upload-signature` returns `{ signature, timestamp, apiKey, cloudName, params }`. The **server decides the folder** from `{ purpose, personaSlug, entityType }` — the client cannot write outside its taxonomy. Signed params include `allowed_formats`, `max_bytes`, `resource_type`, `context`, and for images `eager: 't_djf_card|t_djf_og|t_djf_blur'` + `eager_async` + `eager_notification_url` + `responsive_breakpoints`.

After upload the client POSTs the Cloudinary result to `POST /api/v1/media` — **the server does not trust it**: it re-reads authoritative metadata via `cloudinary.api.resource(publicId)` before inserting the `MediaAsset`. This closes the "client lies about bytes/format" hole common to direct-upload implementations.

Folder taxonomy: `djf/{env}/personas/{slug}/{hero|gallery|avatar}`, `djf/{env}/events/{slug}`, `djf/{env}/tracks/{artwork|audio}`, `djf/{env}/videos`, `djf/{env}/press-kit/{photos|logos|documents}`, `djf/{env}/gear`, `djf/{env}/brands`, `djf/{env}/_tmp`.

Named transformations (bootstrapped once via Admin API, referenced by name so transform strings never scatter into JSX and can be retuned without redeploy):

| Name                  | Definition                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `t_djf_hero`          | `c_fill,g_auto:subject,w_1920,h_1080,q_auto:good,f_auto,dpr_auto` |
| `t_djf_card`          | `c_fill,g_auto:faces,w_800,h_1000,q_auto,f_auto`                  |
| `t_djf_gallery`       | `c_limit,w_1600,q_auto:good,f_auto`                               |
| `t_djf_thumb`         | `c_fill,g_auto,w_400,h_400,q_auto,f_auto`                         |
| `t_djf_blur`          | `c_fill,w_16,h_16,e_blur:400,q_30,f_webp`                         |
| `t_djf_og`            | `c_fill,w_1200,h_630,q_auto,f_jpg`                                |
| `t_djf_logo`          | `c_fit,w_400,h_200,q_auto,f_auto,e_grayscale`                     |
| `t_djf_video_hero`    | `c_fill,w_1920,h_1080,q_auto,vc_auto,br_2m,f_auto,ac_none`        |
| `t_djf_video_preview` | `c_fill,w_640,h_360,so_0,du_6,e_loop,f_webm`                      |
| `t_djf_audio_stream`  | `f_mp3,ac_aac,br_128k`                                            |
| `t_djf_waveform`      | `fl_waveform,co_rgb:FF2D95,b_transparent,w_1200,h_180,f_png`      |

**Placeholders:** on create, fetch the `t_djf_blur` derivative server-side (~400 B), base64 into `blurDataUrl`, compute `blurhash`, capture `dominantColor` from `colors: true`. Stored on the row → `placeholder="blur"` with zero runtime cost.

**Deletion is two-phase, never synchronous with the request:** `DELETE /admin/media/:id` 409s if referenced, listing the referencing entities (`{code:'MEDIA_IN_USE', errors:[{entity,id,title}]}`); `?force=true` (needs `media:delete`) nulls references in a transaction first; then sets `deletedAt` — the asset stays in Cloudinary, recoverable for 30 days from an admin trash view. Nightly sweeper: hard-delete >30d soft-deleted (DB + Cloudinary), prune unclaimed `_tmp/` >24h, and **report-only** reconciliation of Cloudinary-without-DB-row drift (an auto-deleting reconciler is one bug from wiping the DJ's photo library).

**Audio:** Cloudinary treats audio as `resource_type: video`. `durationSec` from the API response; progressive `f_mp3` with `Accept-Ranges` from the CDN is sufficient at this scale (no HLS). `waveformJson` peak arrays generated at upload so wavesurfer never downloads audio just to draw. **Embeds are not media assets** — SoundCloud/Spotify/YouTube live as `Track.embedUrl` / `StreamLink` rows; oEmbed HTML is fetched once, sanitized with `sanitize-html` against a strict iframe allowlist (`w.soundcloud.com`, `open.spotify.com`, `www.youtube-nocookie.com`), cached in `embedHtml` on a 30-day TTL.

### 3.7 API conventions

**Surface:** public reads by **slug** (`GET /api/v1/personas/:slug`), admin writes by **id** (`/api/v1/admin/*`) — slugs change, ids don't. Admin adds `PATCH :id/{publish,unpublish,archive}`, `POST :id/restore`, `PATCH reorder` (bulk `[{id,sortIndex}]` in one transaction — drag-and-drop generates a whole permutation, not N PATCHes), `GET :id/audit`.

**Pagination:** offset for admin tables (needs "page 7 of 23"), cursor for public infinite lists (needs stability). Cursors are opaque base64 of the **full sort tuple + id tiebreaker** — never a bare id, which breaks on any non-unique sort. `X-Total-Count` only in offset mode.

```jsonc
{ "data": [...],
  "meta": { "pagination": { "mode":"cursor", "limit":20,
            "nextCursor":"eyJzaSI6MTIsImlkIjoi...", "hasMore":true },
            "sort": "-startsAt", "filters": { "when":"upcoming" } } }
```

Single resources are **bare** (no envelope) — envelope-everything hurts typed-client DX.

**Filtering:** deliberately **not** a generic `?filter[field][op]=` DSL (unbounded query surface, DoS and index-miss profile). Each resource declares an explicit Zod query schema; `sortSchema(allowlist)` guarantees every sortable column has an index; `includeSchema(allowlist)` maps to fixed Prisma include fragments capped at depth 2 (the N+1 guard). Unknown `fields=` → 422, never silent ignore.

**Idempotency:** `Idempotency-Key` header on all POSTs — replay returns the stored response with `Idempotency-Replayed: true`; same key + different body → 409 `IDEMPOTENCY_KEY_REUSED`. Second layer on inquiries: `(email, eventDate, within 10min)` dedupe for clients that send no header.

**ETag/caching:** strong ETag = sha1 of stable-stringified body; `If-None-Match` → 304. Policies: public content `s-maxage=300, stale-while-revalidate=86400`; `/settings` + `/redirects` `s-maxage=3600`; `/sitemap` `s-maxage=1800`; admin + all non-GET `no-store`.

**ISR revalidation webhook (api → web)** — the single most important integration; the DJ edits and the public page updates in seconds without a redeploy. Services emit `content.changed`; `RevalidationService` maps entity → tags via a `TAG_MAP` and POSTs to `apps/web/api/revalidate` with `x-djf-timestamp` + `x-djf-signature` (HMAC over `${ts}.${body}`). The web route verifies a ±5min timestamp window (kills replay) and `timingSafeEqual`, then calls `revalidateTag`/`revalidatePath`. Retried 3× with exponential backoff, **never blocking the admin write** (the DJ's save must not fail because Vercel hiccuped). A weekly `revalidate-all` cron is the backstop.

### 3.8 Caching, pooling, performance

Three layers, **no Redis at launch**:

| Layer              | Mechanism                                    | TTL                    | Invalidation                                 |
| ------------------ | -------------------------------------------- | ---------------------- | -------------------------------------------- |
| L1 CDN/browser     | `Cache-Control` + ETag; Vercel CDN           | 5min s-maxage, 24h SWR | 304                                          |
| L2 Next Data Cache | `fetch(..., { next: { tags, revalidate } })` | 1h                     | `revalidateTag` webhook — the real mechanism |
| L3 API in-process  | `cache-manager` LRU, `max:500, ttl:60s`      | 60s                    | per-prefix wipe on domain events             |

Redis skipped: single Railway replica makes an in-process LRU strictly faster; L2 absorbs virtually all public read traffic (the API sees near-zero steady-state RPS); sessions are stateless JWT + a DB refresh table. L3 sits behind an interface — `REDIS_URL` present swaps to Upstash in one line. **Redis becomes mandatory at ≥2 API replicas (cache coherence) or when BullMQ arrives.**

**Neon pooling:** `DATABASE_URL` → the `-pooler` (PgBouncer transaction-mode) endpoint with `pgbouncer=true&connection_limit=10&pool_timeout=20`; `DIRECT_URL` → unpooled, migrations only (DDL + advisory locks need a session). `pgbouncer=true` matters — it makes Prisma skip prepared statements, which transaction-mode pooling cannot support. `connection_limit=10` is explicit rather than Prisma's `num_cpus*2+1` default, which on a 4-vCPU container can exhaust the Neon ceiling. **Rejected:** Prisma Accelerate (a network hop + cost to solve serverless connection explosion we don't have) and the Neon serverless driver adapter (HTTP/WS transport is a win for edge, a loss for a long-lived Node process). Neon region `ap-southeast-1` (Singapore) alongside Railway; scale-to-zero **disabled in production**, enabled on preview branches.

**N+1 avoidance, in order of preference:** (1) `relationJoins` preview feature → real `LATERAL JOIN`s for `include`; (2) explicit include allowlists — the API physically cannot be asked for a deep graph; (3) **aggregate page endpoints** for known shapes: `GET /api/v1/personas/:slug/page` returns `{ persona, genres, socialLinks, featuredTracks, playlists, upcomingEvents, pastEventsCount, testimonials, gallery, stats, videos, brands, gear, seo }` from one `findUnique({ include })` + one `$transaction([...counts])`. This BFF concession keeps the public site at ~1 DB round trip per page. A dev-only `$on('query')` counter warns above 8 queries/request — an N+1 canary that CI e2e enforces.

**Raw-SQL migrations beyond `@@index`:** `pg_trgm` + GIN trigram indexes on `events.title`, `tracks.title`, `posts.title`; **partial indexes** on published-only content (`WHERE status='PUBLISHED' AND deleted_at IS NULL`) — the highest-leverage item, making public queries index-only scans over a fraction of the table; a generated weighted `tsvector` + GIN on `posts`; a `CHECK (id='singleton')` on `site_settings`.

### 3.9 Cross-cutting

**Email (Resend + React Email, previewable via `email dev`):** `BookingInquiryNotification` (to the DJ — date, city, ₹ budget, persona, one-click admin deep link), `BookingInquiryAutoresponder`, `InquiryStatusUpdate`, `NewsletterConfirm` (double opt-in), `AdminInvite`, `PasswordReset`, `LoginAlert` (new IP/UA), `WeeklyInquiryDigest`. **Sending is never awaited in-request** — `POST /inquiries` writes the row, emits `inquiry.created`, returns 201 in ~40ms; an `@OnEvent` handler sends and stamps `notifiedAt`. A cron rescans `notifiedAt IS NULL AND createdAt > now()-24h` — a dropped notification costs a booking, so this retry loop is not optional. `MAIL_FROM` requires verified SPF + DKIM + DMARC (`p=quarantine`).

**Jobs — `@nestjs/schedule` cron in-process, BullMQ deferred.** Rejected Vercel Cron (couples content ops to the frontend deploy, duplicates Prisma there); rejected BullMQ at launch (needs Redis + a worker dyno — tripling infra for six crons). Every job wraps in `pg_try_advisory_lock(hashtext($1))` so scaling to 2 replicas never double-runs — 3 lines that prevent a duplicate-email incident.

`publish-scheduled` (*/5m), `mark-past-events` (hourly), `media-orphan-sweep` (03:15 IST), `prune-tokens` (03:30), `analytics-rollup` (03:45, PageView→DailyMetric, drop raw >90d), `retry-failed-mail` (04:00), `inquiry-digest` (Mon 09:00), `revalidate-all` (Sun 05:00). BullMQ trigger conditions: a job >10s, or newsletter sends >500 recipients.

**Press-kit PDF: `@react-pdf/renderer`, not Puppeteer.** Puppeteer means ~300MB Chromium in the container, a class of memory leaks, and 5–10s renders; React-PDF renders the same design system in ~800ms with a 2MB dep. Output uploads to Cloudinary as `resource_type: raw`, recorded as a versioned `PressAsset`, served via a **signed 7-day expiring URL** when `requiresEmail` is set so gated downloads can't be hotlinked. Regenerated manually, or automatically (debounced 10min) when a persona's bio/stats/photos change.

**Sitemap:** `GET /api/v1/sitemap` returns a flat `{loc, lastmod, changefreq, priority, images[]}` feed from one `$transaction` of `select {slug, updatedAt}` across published entities, `s-maxage=1800`, `sitemap`-tagged. `noIndex` entries are filtered server-side — exactly one place decides indexability.

**Security checklist:** HSTS preload; nonce-based CSP with no `unsafe-inline`, `frame-src` limited to the three embed hosts, `img-src` to `res.cloudinary.com`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` denying camera/mic/geo; `X-Frame-Options: DENY` on admin. `whitelist + forbidNonWhitelisted` globally (unknown props are 422, not silently dropped); `@db.VarChar` caps on user strings; MDX/HTML sanitized **on write**. Rate limits: global 120/min/IP, login 10/15min/IP, `POST /inquiries` 3/hour/IP + Cloudflare Turnstile + honeypot + `spamScore` heuristic (link count, all-caps ratio, disposable-email list), upload-signature 30/min/user. `gitleaks` in CI; dual-secret JWT verification window so rotation doesn't log everyone out. PII inventory + DSAR runbook; `PageView` stores a salted daily hash, never a raw IP. Retention: raw PageView 90d, AuditLog 2y, soft-deleted content 30d, SPAM inquiries 30d.

**Backups:** Neon PITR (RPO ~1s) + a nightly `pg_dump -Fc` → Cloudflare R2 (age-encrypted, 30 daily / 12 monthly) with a monthly automated `pg_restore --list` smoke check and a quarterly full restore drill into a scratch branch. **Plus a weekly `rclone` sync of Cloudinary `djf/` to R2** — this matters more than people expect: a compromised admin session plus the `force=true` delete path could remove originals, and Cloudinary's own recycle bin is time-limited.

---

## 4. Prisma schema (`packages/db/prisma/`)

Conventions applied to **every** content model: `cuid(2)` ids · `@@map` to snake_case · soft delete via `deletedAt` (enforced by a **Prisma client extension**, not by hand — `delete` never issues a real `DELETE`) · audit fields `createdAt/updatedAt/createdBy/updatedBy` (populated from the AsyncLocalStorage request context, so audit attribution needs zero plumbing through service signatures) · publish workflow `status/publishedAt/scheduledAt` · `slug` unique · `sortIndex` · optional 1:1 `SeoMeta`.

**`SeoMeta` as a shared 1:1 table, not duplicated columns** — Postgres has no Prisma embeddables; a shared table beats duplicating 8 columns across 12 models and lets the SEO editor be one reusable admin component.

**Enums:** `ContentStatus`(DRAFT/PUBLISHED/ARCHIVED) · `PersonaKey`(FELICITOUS/TRINITROCOSMIC/TNT/COUPLE_DUO) · `TrackType`(ORIGINAL/REMIX/LIVE_SET/MIX/PODCAST/COLLABORATION) · `ReleaseType` · `EventKind`(CLUB/FESTIVAL/WEDDING/CORPORATE/PRIVATE/RADIO/LIVESTREAM) · `EventStatus`(ANNOUNCED/CONFIRMED/SOLD_OUT/CANCELLED/POSTPONED/COMPLETED) · `MediaResourceType` · `MediaPurpose` · `ServiceCategory` · `InquiryStatus`(NEW/CONTACTED/QUOTED/NEGOTIATING/BOOKED/LOST/SPAM/ARCHIVED) · `InquirySource` · `SubscriberStatus` · `AuditAction` · `RedirectKind` · `Currency`(INR default) · `StreamPlatform` · `PressAssetKind` · `GearCategory`(MIXER/CDJ/CONTROLLER/TURNTABLE/DAW/MONITOR/SOFTWARE/OUTBOARD) · `ProficiencyLevel`.

**Models:**

_Identity/RBAC_ — `User` (argon2 hash, `totpSecret` encrypted, `totpRecoveryCodes[]`, `failedLoginCount`, `lockedUntil`, `passwordChangedAt`), `Role`, `Permission`(`@@unique([resource,action])`), `UserRole`, `RolePermission`, `RefreshToken` (`familyId`, `tokenHash @unique`, `revokedReason`, `replacedById`), `AuditLog` (`diff` Json before/after scalars-only, denormalized `actorEmail` surviving user deletion, `requestId`), `IdempotencyKey`.

_Media/SEO_ — `MediaAsset` (`publicId @unique`, `resourceType`, `format`, `bytes`, `width/height/aspectRatio`, `durationSec`, `pages`, `folder`, `purpose`, `colors`/`dominantColor`, `blurDataUrl`, `blurhash`, `altText`, `caption`, `credit`, `tags[]`, `uploadedById`, `deletedAt`), `SeoMeta`.

_Personas_ — `Persona` (`key @unique`, `slug`, `stageName`, `subtitle`, `tagline`, `bio` markdown, `bioShort`, `accentColor` + `accentColorSecondary` + `gradientCss` — **CMS-driven theming**, `isDuo`, `memberNames[]`, `bpmRangeLow/High`, `homeCity`, `heroMediaId`/`avatarMediaId`/`bgVideoMediaId`, `sections` ordered union for the section builder), `Genre`, `PersonaGenre`, `SocialLink` (nullable `personaId` = site-wide; `followerCount` for curated social proof).

_Music_ — `Track` (`type`, `bpm`, `musicalKey`, `durationSec`, `soundcloudTrackId`, `embedUrl`, `embedHtml`, `waveformJson`, `artworkId`, `audioId`, `playCount`, `likeCount`), `TrackGenre`, `StreamLink` (per-track or per-release), `Release`, **`Playlist` + `PlaylistTrack`** (the "audios produced, listenable as a playlist to showcase work" requirement — curated, orderable, persona-scoped, publicly shareable).

_Events/venues/programs_ — `Venue` (`@@unique([name,city])`, lat/lng, capacity — turns the legacy `gigs: string[]` into a linkable, crawlable venue graph), `Event` (`kind`, `eventStatus`, `startsAt` UTC + `timezone` Asia/Kolkata, `ticketUrl`, `ticketPriceMin/Max`, `currency`, `ageRestriction`, `flyerId`, `galleryId`, `isPast` maintained by cron for a cheap partial index, `attendanceEstimate`), `EventLineupSlot` (free-text `artistName` for guests + optional `personaId`, `isHeadliner`, set times), **`Program`** (recurring/branded nights & shows performed — "Housefull Sunday", "Big Bollywood Night", "Clubbers Friday" — with residency dates, venue, persona, gallery).

_Career_ — **`ExperienceEntry`** (work-experience timeline: role, org, `startDate`/`endDate`/`isCurrent`, location, highlights[], logo), **`GearItem`** (`category`, brand, model, `proficiency`, years used, notes, image — the console/gear experience showcase, doubles as tech-rider source data).

_Social proof_ — `Testimonial` (`authorName`, `authorRole`, `venueOrEvent`, `quote`, `rating`, `isVerified` — **legacy fabricated entries are not seeded**), `Brand` + `PersonaBrand` (logo strip, mono logo variant), `Stat` (`value` as String so "10M+" works, plus `numericValue` for animation targets, `@@unique([personaId,key])`).

_Content_ — `Service` (category, `inclusions[]`/`exclusions[]`, `priceFrom`/`priceTo` Decimal + `currency` INR, `durationHours`, addons), `Faq`, `PressAsset` (`kind`, `version`, `requiresEmail`, `downloadCount`), `Post` + `PostTag` (Tiptap **JSON**, not HTML — the frontend renders through a typed `RichText` component and can never receive injected markup; generated weighted `searchVector`), `Video`, `Gallery` + `GalleryItem`, `StaticPage`.

_Engagement_ — `BookingInquiry` (`reference` `INQ-YYYY-NNNN`, name/email/phone, `eventType`, `eventDate`, `venueText`, `city`, `guestCount`, `durationHours`, `budgetMin`/`budgetMax` Decimal + `currency` **INR**, `personaId`, `message`, `status` pipeline, `source`, `assignedToId`, `spamScore`, `notifiedAt`/`autoRespondedAt`, UTM fields), `InquiryNote`, `NewsletterSubscriber` (double opt-in tokens, `status`).

_Site_ — `SiteSettings` (singleton: brand, contact, NAP, WhatsApp number, default SEO, theme defaults, feature flags, integration keys-by-reference), `Redirect` (legacy URL map), `PageView` (salted daily `visitorHash`), `DailyMetric`.

---

## 5. Frontend architecture (`apps/web`, Next.js 15)

### 5.1 Principles

1. **Server-first.** A component is a Client Component only if it needs state, DOM refs, browser APIs, or handlers _that cannot be delegated to a leaf_. The legacy failure mode is banned by a **custom ESLint rule: no `'use client'` in `app/**/page.tsx` or `app/**/layout.tsx`.** Budget: ≤6 client islands and ≤90KB route-specific JS per route.
2. **One token source of truth** — `packages/ui/src/styles/theme.css`. A custom lint rule bans raw hex/rgb/oklch literals in `apps/web`.
3. **Motion is a layer, not a dependency.** Every signature interaction degrades to a static, beautiful, server-rendered composition. Reduced-motion and low-end paths are designed _first_.
4. **Budget-enforced** — Lighthouse CI + `size-limit` are merge gates.
5. **Content is data.** Every string, image, accent color, and section order comes from the API. Personas are rows, not routes.

### 5.2 `app/` tree

Route groups `(marketing)` / `(legal)`. **Personas are a dynamic `[persona]` route with `generateStaticParams`** — static-route performance, CMS-route flexibility; a fifth persona ships with zero code. Legacy had four near-duplicate 600-line client pages that drifted.

```
app/
├─ layout.tsx  globals.css  manifest.ts  robots.ts  sitemap.ts
├─ icon.tsx  apple-icon.tsx  global-error.tsx
├─ (marketing)/
│  ├─ layout.tsx  template.tsx  error.tsx  loading.tsx  not-found.tsx
│  ├─ page.tsx  opengraph-image.tsx                      # HOME
│  ├─ [persona]/{layout,page,opengraph-image,loading,error}.tsx
│  │  └─ (sub)/{music,gallery}/page.tsx
│  ├─ music/{page,opengraph-image}.tsx
│  │  ├─ [slug]/{page,opengraph-image}.tsx
│  │  ├─ albums/[slug]/page.tsx
│  │  └─ playlists/[slug]/page.tsx
│  ├─ events/{page}.tsx  events/[slug]/{page,opengraph-image}.tsx
│  │  └─ archive/[[...year]]/page.tsx
│  ├─ programs/{page,[slug]/page}.tsx
│  ├─ venues/{page,[slug]/page}.tsx
│  ├─ gallery/
│  │  ├─ page.tsx
│  │  ├─ @modal/{default.tsx, (.)photo/[id]/page.tsx}     # intercepting lightbox
│  │  └─ photo/[id]/page.tsx                              # canonical, SEO + ImageObject
│  ├─ videos/{page.tsx, @modal/..., watch/[id]/page.tsx}
│  ├─ about/page.tsx                                      # story + experience timeline
│  ├─ setup/page.tsx                                      # console/gear showcase
│  ├─ services/{page,[slug]/page}.tsx
│  ├─ press/page.tsx  rider/page.tsx  testimonials/page.tsx
│  ├─ blog/{page,[slug]/page,tag/[tag]/page}.tsx
│  ├─ faq/page.tsx  contact/page.tsx  book/{page,thanks/page}.tsx
│  └─ (legal)/{privacy,terms,cookies}/page.tsx
└─ api/                                                    # BFF-only route handlers
   ├─ revalidate/route.ts        # HMAC-verified webhook from NestJS
   ├─ draft/route.ts  draft/disable/route.ts
   ├─ press/download/route.ts  rider/pdf/route.ts
   ├─ feed.xml/route.ts  feed.json/route.ts  events.ics/route.ts
   └─ search-index/route.ts  health/route.ts
```

**301 redirects in `next.config.ts`** preserving legacy URLs: `/bollywood → /felicitous`, `/psytrance → /trinitrocosmic`, `/techno → /tnt`, `/couple-duo → /felicitous-x-geetz`, `/discography → /music`. Plus dynamic redirects from the `Redirect` table via middleware.

### 5.3 Rendering strategy

| Route                                                                                 | Strategy                                                            | Cache tags                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                                                                                   | Static shell + **PPR**; upcoming-gigs slot streamed, ISR 300s       | `home, personas, events:upcoming, tracks:featured, testimonials` |
| `/[persona]`                                                                          | `generateStaticParams` → SSG, `revalidate: false` (tag-driven)      | `persona:{slug}, tracks:persona:{slug}, gallery:persona:{slug}`  |
| `/music`, `/music/[slug]`, playlists                                                  | SSG; client-side filtering of a prefetched payload (<200 tracks)    | `tracks, albums, playlists, track:{slug}`                        |
| `/events`                                                                             | Static shell; Upcoming = dynamic in Suspense (ISR 300s); Past = SSG | `events:upcoming, events:past`                                   |
| `/events/[slug]`                                                                      | SSG; ticket-availability slot ISR 600s                              | `event:{slug}`                                                   |
| `/gallery`, `/videos`                                                                 | SSG first page; further pages via server action                     | `gallery, videos`                                                |
| `/about /setup /services/* /press /rider /faq /testimonials /programs /venues /legal` | SSG                                                                 | `page:{slug}, services, faqs, gear, experience`                  |
| `/blog*`                                                                              | SSG + `draftMode` dynamic bypass                                    | `posts, post:{slug}`                                             |
| `/contact`, `/book`                                                                   | Static shell + form islands; availability check `no-store`          | —                                                                |
| `sitemap`, feeds                                                                      | ISR 3600s                                                           | `sitemap`                                                        |

PPR opted into per-route (`experimental_ppr = true`) on `/`, `/[persona]`, `/events`, `/events/[slug]`: static shell = hero + nav + layout; dynamic holes = upcoming gigs, live play counts, ticket status, availability badge.

**Cache-tag taxonomy lives in `packages/contracts/src/cache-tags.ts` and is mirrored exactly in NestJS's `TAG_MAP`** so webhook payloads are trivially derivable and never drift.

**Server Actions** for all public mutations (booking, newsletter, contact) — no client bundle on the submit path, progressive enhancement works, rate-limited in the action. **TanStack Query** for admin CRUD only (optimistic updates, cross-list invalidation, retry, pagination — server actions would fight the client cache). **Never call NestJS from the public browser** — keeps the API key server-side, avoids CORS, keeps the origin cacheable.

### 5.4 Data layer — `packages/contracts` (Zod SSOT), not OpenAPI codegen

One Zod schema produces: (a) Nest DTO + runtime validation via `nestjs-zod`'s `createZodDto`, (b) the generated OpenAPI doc, (c) inferred TS types for web/admin, (d) react-hook-form resolvers, (e) response parsing at the frontend boundary. **A breaking API change fails `pnpm typecheck` in CI before deploy.** OpenAPI-first would need a generator step, produce weaker types (no refinements, no branded types), and give the frontend no runtime validation. OpenAPI is still emitted from the same schemas for Swagger.

`packages/api-client/src/server.ts` (`import 'server-only'`): `apiGet<S extends ZodTypeAny>(path, { schema, tags, revalidate, cache, searchParams, draft })` → builds the URL, sends `x-api-key`, passes `next: { tags, revalidate }` (or `no-store` in draft mode), maps 404 → `ApiError(404)`, and **`safeParse`s the response** — contract drift logs the flattened error and throws `ApiError(502)` rather than corrupting the page.

Typed domain queries in `apps/web/src/server/queries/*.ts` own their tags (pages never pass tags themselves) and are wrapped in `React.cache()` — this halves API calls on routes where `generateMetadata` and the page body need the same data.

Error boundaries: brand-styled `global-error.tsx`; `(marketing)/error.tsx` with retry; per-section `<ErrorBoundary>` around _optional_ sections (visualizer, map, live stats) so a data hiccup never blanks a page; a "no signal" CRT-static 404 with search + top links.

### 5.5 Design system

**Tailwind v4 `@theme` in `packages/ui/src/styles/theme.css`** — OKLCH throughout. Neutrals are a blue-cooled charcoal ramp `--color-ink-950 … ink-050` (not pure gray). Source accent ramps: flame/rose (Bollywood), violet (Psytrance), cyan (Techno), lime (duo secondary). Components only ever use **semantic aliases**: `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-fg`, `--color-fg-strong`, `--color-fg-muted`, `--color-accent`, `--color-accent-strong`, `--color-accent-soft`, `--color-on-accent`, `--color-focus`.

**Persona theming = remapping semantic aliases only**, never new tokens:

```css
[data-theme='tnt'] {
  --color-accent: var(--color-cyan-400);
  --color-accent-strong: var(--color-cyan-500);
  --gradient-persona: linear-gradient(180deg, var(--color-cyan-400), oklch(0.55 0.09 210));
  --radius-lg: 2px;
  --radius-xl: 2px; /* industrial: sharp corners */
  --font-display: var(--font-jetbrains); /* techno: mono display */
}
```

`data-theme` is set **server-side** in the persona layout, so the correct accent is in the first HTML paint — no flash. The home page's channel switcher sets it transiently on `documentElement`, and `@property --color-accent { syntax: "<color>" }` registration makes the accent _interpolate_ on a `--duration-slow` transition. Accents also come from the CMS (`persona.accentColor`) as an inline style on the wrapper, so the DJ retunes a persona's color without a deploy; `theme.css` is the fallback.

Also tokenized: fluid type scale (`--text-display: clamp(3.5rem, 1rem + 11vw, 11rem)` with `line-height: 0.85`), spacing (`--spacing-section`, `--spacing-gutter`), radii, `--shadow-glow`, and **motion tokens** (`--ease-out-quart`, `--ease-in-out-quint`, `--ease-spring`, `--duration-instant|fast|base|slow|scene`). A `prefers-reduced-motion` block drives every duration token to 1ms — a global kill-switch rather than per-component patches.

**Fonts — exactly 3 self-hosted variable woff2 files, latin-subset, ≤140KB total**, via `next/font/local` (so a missing file is a **build error**, not the legacy silent fallback): display = **Anybody** variable (wide, brutalist, techno-poster; commercial alt: Monument Extended); body = **Satoshi** variable (geometric, neutral, reads professional to wedding planners); mono = **JetBrains Mono** variable (BPM/keys/timecodes/rider, and TNT's display face — the "we know electronic music" signal). Display + sans preloaded, mono `preload: false`. `adjustFontFallback` metrics keep CLS at 0.

**`packages/ui`:** `primitives/` (Button, Input, Dialog, Drawer, Tabs, Accordion, Slider, Tooltip, DropdownMenu, Toast…), `composites/` (SectionHeader, MediaCard, TrackCard, EventCard, PersonaCard, ServiceCard, TestimonialCard, StatCounter, Marquee, Lightbox, WaveformPlayer, MiniPlayer, VideoPlayer, Masonry, Timeline, FilterBar, CTABand, PriceTable, FaqAccordion, BrowseWheel, RichText, GearGrid), `layout/` (Container, Stack, Grid, Section, Hero, Split, Bleed).

**shadcn/ui + Radix: vendored source, not a dependency.** Copy shadcn primitives into `packages/ui/primitives`, immediately restyle onto our semantic tokens (dropping shadcn's `hsl(var(--x))` convention), and keep `@radix-ui/react-*` as real deps for behavior/a11y (Dialog focus trap, DropdownMenu typeahead, Accordion, Tabs, Slider — all WCAG-correct out of the box, which we'd otherwise get wrong). Radix gives the hard accessibility for free; owning the source means the aesthetic isn't fighting a vendor's design opinions. Plus `vaul` (mobile drawers), `sonner` (toasts), `cva` + `tailwind-merge` on every primitive.

**Icons:** `lucide-react` for UI (per-icon import), `@icons-pack/react-simple-icons` for brand marks, hand-authored inline SVGs for audio glyphs (waveform, crossfader, CDJ, EQ). No icon fonts, no `react-icons` — legacy shipped both `lucide-react` and `react-icons`.

### 5.6 Cinematic + maximum-interactivity experience set

Stack, deliberately small: **`motion` (Framer v12)** for orchestration · **native CSS scroll-driven animations (`animation-timeline: view()`)** as the default for scroll effects · **`three` + `@react-three/fiber`** only inside dynamically imported islands · **`lenis`** smooth scroll · **`wavesurfer.js`** waveforms. `packages/motion` exports `useReducedMotion()`, `useCapability()` (deviceMemory / hardwareConcurrency / `saveData` / battery / coarse pointer) and **`<MotionGate heavy light>`** — every heavy experience routes through it.

| #   | Experience                                                                                                                                                                                                                         | Technique                                                                                                                                                                                                                     | Cost                                                                                                        | Fallback                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Cinematic scroll sequence** — each major section is a full-viewport video/photo with overlaid display type; the page reads as a film reel                                                                                        | `position: sticky` sections + `animation-timeline: view()` crossfades; Cloudinary-derived ≤2.5MB 8–10s loops, `muted playsInline loop preload="none"`, poster = frame-0 AVIF (**the poster is the LCP; video is decorative**) | ~0 JS; video starts only on `canplay` + IntersectionObserver + not `saveData` + not reduced-motion          | Poster stills with the same overlaid type — identical composition, zero video                                                                                                                     |
| 2   | **Persona "channel switcher"** — the signature module. Hardware-selector strip; hover/focus interpolates accent CSS vars, crossfades a 6s clip, fires an RGB-split glitch wipe                                                     | `@property` var transitions + `motion` + a 12-line GLSL shader in a lazily loaded R3F island; roving tabindex over real `<a>` children                                                                                        | shader island 42KB gz, loaded on `pointerenter`/focus; idle 0                                               | CSS crossfade of `next/image` posters + accent transition (~1KB). Mobile → snap-scrolled cards                                                                                                    |
| 3   | **Per-persona WebGL background** — warm bokeh light-leaks / kaleidoscopic fractal / mono cyan grid + scanlines / dual-portrait displacement                                                                                        | One shared `<ShaderCanvas>`, single full-screen quad, `variant` uniform → **one chunk for all four**; DPR capped 1.25, `frameloop="demand"`, paused by IntersectionObserver + `visibilityState`                               | 95KB gz, GPU-bound                                                                                          | A CSS-only equivalent (radial/conic gradients + `mask-image` grain + blend modes) is **always** in the HTML; the canvas fades in over it. **The page is complete and on-brand without any WebGL** |
| 4   | **3D turntable scene** — an interactive CDJ/vinyl deck; drag the platter to scrub the currently playing track, jog-wheel responds to audio                                                                                         | R3F + a low-poly GLTF (Draco-compressed, ≤600KB), `@react-three/drei` `useGLTF` + `Environment`, `frameloop="demand"`                                                                                                         | ~150KB gz + model, `dynamic(ssr:false)`, mounted on scroll-into-view only, desktop + `deviceMemory>=4` only | A static hero-quality render of the same model as an AVIF, with the real waveform player beneath it                                                                                               |
| 5   | **3D gig globe** — rotating globe with arcs to every city played; click a city → its events                                                                                                                                        | R3F + a shared `three` chunk with #3/#4, points + arc geometry from `Venue.lat/lng`                                                                                                                                           | +45KB on top of the shared three chunk                                                                      | `react-simple-maps` India TopoJSON 2D map, and beneath that a **server-rendered grouped list of cities with counts and links** — better for SEO than any canvas                                   |
| 6   | **Audio-reactive visualizer** — when the mini-player plays, hero bars/particles pulse to real FFT data                                                                                                                             | Web Audio `AnalyserNode` (fftSize 512) → one canvas 2D at DPR≤1.5, RAF throttled to 30fps, `OffscreenCanvas` worker where supported                                                                                           | ~7KB, no lib; 2–4% CPU; mounts on first play                                                                | Static SVG from stored `waveformJson` peaks. **Never autoplays audio**                                                                                                                            |
| 7   | **Sticky mini player with waveform** — persists across navigations (lives in `(marketing)/layout.tsx` above the route slot, so App Router never unmounts it), queue, prev/next, click-to-seek, expand to full-screen "now playing" | `wavesurfer.js` v7 fed **pre-computed peaks from the API** so it never downloads audio to draw; Zustand queue store                                                                                                           | wavesurfer 24KB gz on first play; shell 4KB                                                                 | Plain styled `<audio controls>` over the static peak SVG. Full keyboard: Space, ←/→ ±5s, ↑/↓ volume, M, N/P — announced via `aria-live`                                                           |
| 8   | **Scroll-driven reveals** — heading masks, `clip-path` image expands, counters, persona progress rail                                                                                                                              | Native `animation-timeline: view()` behind `@supports`; `motion` `whileInView` only for the ~5 stagger sequences                                                                                                              | ~0 JS, compositor-only                                                                                      | `motion-ok:` variant → reduced motion renders the final state instantly                                                                                                                           |
| 9   | **Lenis smooth scroll**                                                                                                                                                                                                            | `ReactLenis` provider in `(marketing)/layout.tsx`, `autoRaf` shared with the visualizer RAF loop                                                                                                                              | 8KB gz                                                                                                      | Disabled under reduced motion, on touch (native momentum is better), and when `hardwareConcurrency <= 4`                                                                                          |
| 10  | **View Transitions** — persona→persona keeps hero image + title as shared elements                                                                                                                                                 | Native `@view-transition { navigation: auto }` + `experimental.viewTransition`; `view-transition-name` from entity id                                                                                                         | ~0                                                                                                          | Instant navigation, no polyfill                                                                                                                                                                   |
| 11  | **Gesture lightbox** — pinch-zoom, swipe, drag-dismiss, filmstrip, keyboard                                                                                                                                                        | Intercepting route + Radix Dialog (focus trap) + `motion` drag + `@use-gesture/react`; current ±1 prefetched                                                                                                                  | 18KB gz, route-split                                                                                        | Hard nav to `/gallery/photo/[id]` = the same experience fully SSR'd, no JS                                                                                                                        |
| 12  | **Marquee ticker** — venues, "NOW BOOKING 2026", upcoming cities                                                                                                                                                                   | Pure CSS keyframes on a duplicated `aria-hidden` copy; paused on hover/focus-within and offscreen                                                                                                                             | 0 JS                                                                                                        | Static, horizontally scrollable list of real links                                                                                                                                                |
| 13  | **Magnetic buttons + cursor spotlight**                                                                                                                                                                                            | 30-line hook → CSS vars `--mx/--my`, `translate3d` capped 8px, radial-gradient spotlight; RAF-coalesced                                                                                                                       | 1.5KB, only under `(hover:hover) and (pointer:fine)`                                                        | Not mounted on touch at all. Reduced motion → border-glow only                                                                                                                                    |
| 14  | **Custom cursor** morphing to "PLAY ▶ / VIEW / DRAG" over media                                                                                                                                                                    | One fixed element, `mix-blend-mode: difference`, text from `data-cursor` attrs                                                                                                                                                | 2KB                                                                                                         | Off on touch/reduced-motion; native cursor never hidden for keyboard users                                                                                                                        |
| 15  | **3D tilt cards**                                                                                                                                                                                                                  | CSS-only `preserve-3d` + `rotateX/Y` from pointer vars                                                                                                                                                                        | 0                                                                                                           | `hover-hover:` gated; reduced motion → 2px lift                                                                                                                                                   |
| 16  | **Animated stat counters**                                                                                                                                                                                                         | `motion` `useSpring` + `useInView`, `Intl.NumberFormat('en-IN')` (lakh grouping — correct for the audience)                                                                                                                   | 0                                                                                                           | Final number rendered server-side; the counter _starts_ from it, so no CLS or empty state                                                                                                         |
| 17  | **Hero "load the room" entrance** — display headline lines rise behind masks, accent bar sweeps, nav de-blurs                                                                                                                      | CSS-only line masks over server-rendered `<span>`s — **no JS text splitting** (avoids the classic SplitText CLS/a11y disaster); the `<h1>` stays one accessible string                                                        | 0 JS                                                                                                        | Opacity 1 immediately                                                                                                                                                                             |
| 18  | **Command palette `⌘K`** — jump to persona/track/event/page (a power move for planners and press)                                                                                                                                  | `cmdk` + a ≤25KB ISR'd search index                                                                                                                                                                                           | 12KB gz on first open                                                                                       | Keyboard-native by design; a plain `/search` page is the non-JS path                                                                                                                              |
| 19  | **Grain + scroll-velocity bloom** — ties the site to a film/rave aesthetic                                                                                                                                                         | Inlined SVG `feTurbulence` data URI (400B) + `mix-blend-mode: overlay`                                                                                                                                                        | ~0                                                                                                          | Grain stays (static, cheap); velocity-bloom is `motion-ok:` only; opacity 0 under `forced-colors`                                                                                                 |
| 20  | **Booking wizard micro-interactions** — step morph, date-availability pulse, waveform-bar success burst                                                                                                                            | `motion` layout animations + a 1KB canvas burst                                                                                                                                                                               | negligible                                                                                                  | Instant step change; success announced via `role="status"`                                                                                                                                        |

**No scrolljacking anywhere** — it's a CWV and a11y liability. Sticky/crossfade sections give the cinematic feel while native scroll stays untouched. **No flashing above 3Hz** (the glitch wipe is explicitly capped and skipped under reduced motion). Motion governance: all durations/easings from tokens, variants centralized in `packages/motion/variants.ts`, a lint rule forbids transitioning `width/height/top/left`.

### 5.7 Media performance

Custom **Cloudinary loader** (`f_auto,q_auto:good,w_{width},c_limit,dpr_auto,fl_progressive:steep`) with `formats: ['image/avif','image/webp']`, explicit `deviceSizes`/`imageSizes`, `minimumCacheTTL: 31536000`. A **`SIZES` constant module** (`heroFull`, `half`, `cardGrid3`, `cardGrid4`, `masonry`, `thumb64`) — never ad-hoc `sizes` strings. `MediaImage` contracts always carry `{ publicId, width, height, alt, blurDataURL, focalX, focalY, dominant }` — `blurDataURL` comes from the DB so `placeholder="blur"` costs nothing at runtime, and `focalX/Y` drive `object-position` so cropped hero portraits never decapitate the DJ.

Exactly **one `priority` image per route** (the LCP element) with `fetchPriority="high"` and a server-emitted `<link rel="preload" as="image" imagesrcset>`; `loading="lazy" decoding="async"` everywhere else; `preconnect` to `res.cloudinary.com`. Long-form video (aftermovies, full sets) uses Cloudinary adaptive HLS with `hls.js` lazy-loaded only when `canPlayType` says no native HLS. Every video has `<track kind="captions">`; the hero loop is `aria-hidden` decoration.

**Budgets (gzip, `size-limit` CI gates):** first-load JS `/` ≤145KB · `/[persona]` ≤155KB · content routes ≤120KB · framework chunk ≤92KB · any lazy island ≤100KB (3D scenes exempt to ≤200KB, gated to desktop+capable) · fonts ≤140KB · CSS ≤28KB · admin ≤320KB.
**CWV targets:** LCP ≤2.0s p75 (4G Moto G) · INP ≤150ms · CLS ≤0.02 · TBT ≤200ms · Lighthouse Perf ≥92 mobile / ≥98 desktop · A11y 100 · SEO 100.

### 5.8 SEO

`generateMetadata` on **all ~28 route patterns**, reading CMS `seo` fields with computed fallbacks, title template `%s | DJ Felicitous — DJ in Bangalore`, `alternates.canonical`, `languages: { 'en-IN', 'x-default' }`, OG `locale: en_IN`, `robots: { 'max-image-preview': 'large', 'max-snippet': -1 }`, and `index: false` for unpublished/draft/thanks/admin.

**Dynamic OG images** per entity via `next/og` (persona-accent gradient mesh + grain, huge display type, the entity's Cloudinary image as a masked panel, "DJ FELICITOUS · BANGALORE" lockup, and a rendered peak-array waveform for tracks). Shared layout in `packages/seo/og` keeps each generator ~15 lines; fonts subset to Latin uppercase + digits (~18KB) for the edge limit.

**JSON-LD as one merged `@graph` per page** (one script tag, no duplicates, entities cross-referenced by stable `@id`), typed with `schema-dts`:

- Root layout (every page): `WebSite` (+ `SearchAction`, `inLanguage: en-IN`), `Organization`, `BreadcrumbList`.
- `/`: `Person`, `MusicGroup`, `LocalBusiness`/`EntertainmentBusiness`, `ItemList` of personas + upcoming events.
- `/[persona]`: `MusicGroup` (genre, `member`, `track`, `album`, `sameAs`, `foundingLocation: Bangalore`), `ImageObject`.
- `/music/[slug]`: `MusicRecording` (`byArtist`, ISO-8601 `duration`, `inAlbum`, `datePublished`, `audio: AudioObject`, `sameAs` streaming links). Albums → `MusicAlbum`; playlists → `MusicPlaylist`.
- `/events/[slug]`: `MusicEvent` (`eventStatus`, `eventAttendanceMode`, IST-offset dates, `location: Place` + `PostalAddress` + `geo`, `performer`, `organizer`, `offers: Offer` with `priceCurrency: INR`).
- `/services/*`: `Service` + `OfferCatalog` with `priceSpecification`, `areaServed: [Bengaluru, Karnataka, India]`; page-level `FAQPage`.
- `/faq`: `FAQPage`. `/videos/watch/[id]`: `VideoObject` (+ `hasPart: Clip[]` chapters, transcript). `/gallery/photo/[id]`: `ImageObject` (+ `license`, `acquireLicensePage`). `/blog/[slug]`: `BlogPosting`. `/about`: `AboutPage` + `Person` with `performerIn`. `/testimonials`: `Review` + `AggregateRating` — **only** for real, on-page reviews (Google penalty risk otherwise; the legacy fabricated festival testimonials are exactly what not to do).

**Sitemaps** split via `generateSitemaps()` behind an index (`static, personas, music, events, programs, venues, gallery, videos, blog, services`), with **real per-entity `lastModified` from `updatedAt`** (not build time), `changeFrequency`/`priority` computed from recency, and `images` on gallery/event entries. `revalidateTag('sitemap')` on every publish → Google sees fresh `lastmod` within minutes. Plus `/api/feed.xml` (RSS), `/api/feed.json`, and **`/api/events.ics`** — a subscribable gig calendar that planners and venues actually use, and that earns backlinks.

`robots.ts`: production allows all + explicitly allows `GPTBot` (AI answers should cite the DJ), disallows `/admin`, `/api/`, `/draft`, `/book/thanks`, and faceted `?sort=`/`?page=`; non-production disallows everything.

**Local SEO for Bangalore/India:** one canonical `LocalBusiness` `@id` with `areaServed` (Bengaluru + Karnataka + India + destination weddings), Bengaluru `geo`, `priceRange`, E.164 `telephone`, `hasMap` to the Google Business Profile, footer NAP consistency, and a CMS-tracked `citations` list. **Location + venue landing pages** (Phase 8, CMS-driven, never doorway spam — each has unique venue lists, real galleries, real testimonials): `/services/weddings/bangalore`, `/services/weddings/goa`, `/services/corporate/bangalore`, `/venues/[slug]`. Query clusters (_wedding DJ Bangalore_, _sangeet DJ Bangalore_, _psytrance DJ India_, _techno DJ Bangalore_, _corporate event DJ Bengaluru_, _book DJ Bangalore price_) each map to exactly one canonical page, with an internal-linking matrix in the CMS to prevent cannibalisation.

**i18n readiness without the dependency:** all copy already comes from the API (a `locale` column is additive), `hreflang` from a single helper, routes are slug-driven, middleware has a commented locale-negotiation branch. No `next-intl` until Hindi/Kannada actually ship.

**Analytics:** Plausible (cookieless) primary + Vercel Speed Insights for RUM CWV; GA4 **only after consent** via the `@dj/analytics` consent-gated bus. Events: `persona_channel_switch`, `track_play`, `track_complete_50`, `booking_started`, `booking_step_{n}`, `booking_submitted`, `whatsapp_click`, `phone_click`, `press_kit_download`, `rider_download`, `event_ical_add`, `gallery_lightbox_open`, `video_play`, `outbound_platform_click`. A non-blocking, keyboard-accessible consent banner writes a cookie read **server-side**, so no tag ships to non-consenting users.

### 5.9 Accessibility (WCAG 2.2 AA)

One `<h1>` per page, no skipped levels, real landmarks, three skip links (content / player / navigation).

**Contrast on a neon palette is designed, not hoped:** neon accents are used only as text on `ink-950` (≥7:1) or as fills with `ink-950` text on them (≥8:1) — never accent-on-accent. `--color-fg-muted` pinned ≥4.6:1; non-text contrast ≥3:1. **A Vitest test iterates the documented token pairing matrix with `culori` and fails CI** below 4.5:1 (3:1 for ≥24px). `forced-colors: active` strips gradients/glows; `prefers-contrast: more` swaps to a higher-contrast token set.

Focus: `:focus-visible` 2px ring + 3px offset with a dark outer ring so it's visible over images; Radix handles dialog traps/restore; a `RouteAnnouncer` moves focus to the new `<h1>` and updates an `aria-live` region.

WCAG 2.2 specifics honored: **2.4.11** (`scroll-padding-top`/`scroll-margin` so the sticky header and mini-player never obscure a focused element) · **2.5.7** (lightbox drag-dismiss and admin drag-reorder both have button alternatives) · **2.5.8** (≥24×24, 44×44 for primary touch targets) · **3.2.6** (contact/WhatsApp affordance in the same place on every page) · **3.3.7** (the wizard never re-asks data) · **3.3.8** (admin login supports password managers, no puzzles; Turnstile has a non-interactive path).

Player: `role="region"`, real `<button>`s with flipping labels, seek as `role="slider"` with `aria-valuetext="1 minute 24 seconds of 6 minutes"`, waveform canvas `aria-hidden` with the slider as the accessible interface, shortcuts documented in a `?` dialog, nothing autoplays with sound. Lightbox: `aria-modal`, "Photo 4 of 32" announcements, Esc returns focus to the originating thumbnail, background `inert`. **Alt text is a required field on media upload — admin blocks publish without it.**

Forms: visible labels, `aria-describedby` hints, `aria-invalid` + `role="alert"` errors, an error summary with anchor links on submit, `autocomplete` tokens, no placeholder-as-label, no color-only signalling.

Motion: global token kill-switch **plus a persistent in-UI "Reduce motion" toggle** stored in a cookie read server-side → `data-motion="reduced"` on `<html>` before first paint (WCAG 2.3.3).

Zoom: **no `maximum-scale`/`user-scalable`** (the explicit legacy bug); reflow to 320px at 400% with no 2D scrolling.

Verification: `vitest-axe` per component, `@axe-core/playwright` on every route with a zero-serious-violation merge gate, keyboard-only scripted traversals, and manual NVDA + VoiceOver passes as phase exit criteria.

---

## 6. Admin panel (`apps/admin`)

Collapsible left sidebar grouped Content / Media / Bookings / Site / System; top bar with `⌘K`, environment badge, "View site" + "Preview draft". Edit screens are **two-column**: form left, sticky right rail with Status, publish/schedule, an SEO panel (live SERP + OG previews with character counters), slug editor with collision check, revision history, and "Open live preview".

**Lists:** TanStack Table, server-side pagination/sort/filter, saved views, bulk actions, inline quick-edit, `j/k`/Enter row navigation, and a `@drawer` parallel route for quick-edit without losing list state.

**Rich text: Tiptap v3, storing JSON not HTML** — the frontend renders through a typed `RichText` component and can never receive injected markup. Custom nodes we actually need: `TrackEmbed`, `PlaylistEmbed`, `EventEmbed`, `GalleryEmbed`, `Callout`, `Figure` (alt + caption enforced), SoundCloud/YouTube oEmbed; `/` slash-command menu + bubble toolbar. Rejected: Lexical (thinner embed ecosystem), MDX-in-textarea (non-technical author), Quill/Draft (legacy).

**Media library:** grid/list, folder + tag + persona filters, search, infinite scroll, picker mode. `react-dropzone` drag-and-drop with folder support, per-file progress, concurrency 3, resumable chunked upload for large video, paste-from-clipboard. **Alt-text gate** before an asset can attach to published content. Cropping via `react-easy-crop` writing **Cloudinary transformation params, not new files** — non-destructive and re-croppable forever (16:9 / 4:5 / 1:1 / 21:9 presets); a click-to-set focal-point picker writes `focalX/Y`.

**Reorder:** `@dnd-kit` (persona sections, gallery order, tracklists, playlists, FAQ, nav) with its `KeyboardSensor` + live-region announcements **and** explicit "Move up/Move down" menu items for WCAG 2.5.7. Persisted as one optimistic `PATCH /reorder` using **fractional indexing**, so reordering one item never rewrites the whole list.

**Draft/publish/schedule:** segmented status control, IST date-time picker with relative text ("publishes in 3 days"), diff against the live version. **Live preview via Next.js Draft Mode**: `POST /api/draft` (validated preview token) sets the cookie and redirects to the entity's public URL; the edit screen embeds it in a resizable iframe (desktop/tablet/mobile presets) and posts form state on debounce; the route is `no-store` so drafts never poison the CDN, and an unmistakable "DRAFT — exit preview" bar renders on any draft page.

**Forms:** react-hook-form + the _same_ Zod contract the API uses, `mode: 'onBlur'`, unsaved-changes guard (`beforeunload` + App Router navigation intercept), autosave-to-draft every 20s with a "Saved 12:04" indicator, and **optimistic-concurrency conflict detection** via `updatedAt` (409 → "Someone else edited this" merge dialog).

Optimistic updates via TanStack Query `onMutate` + rollback + a `sonner` "Retry" toast; publish actions surface the revalidation result ("Live in ~5s") because that round-trip is user-visible trust. Audit-log table with a before/after JSON diff viewer, IST timestamps, linked from each entity's revision history. RBAC gating is **server-side** (sidebar and route segments render from the session's permission set — never hidden with CSS), with a `<Can action on>` component for in-page affordances; the API is the enforcement point. Plus `⌘K`, `⌘S` save, `⌘⏎` publish, `g e` go-to-events, a **booking-inquiry Kanban** (`new → contacted → quoted → negotiating → booked → lost`), and an availability calendar showing held/confirmed dates with conflict warnings.

---

## 7. Testing & tooling

| Layer           | Tool                                                                                                | Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API unit        | Vitest                                                                                              | services with mocked repos, mappers, slug/cursor/permission logic, Zod schemas                                                                                                                                                                                                                                                                                                                                                                                                                               |
| API integration | Vitest + **Testcontainers** `postgres:16-alpine`                                                    | repositories against real Postgres, soft-delete extension, transactions, constraint violations, the raw-SQL indexes                                                                                                                                                                                                                                                                                                                                                                                          |
| API e2e         | Vitest + supertest on a booted app                                                                  | auth matrix (login/fail/locked, rotation, **reuse → family revoked**, 2FA + recovery, CSRF), RBAC matrix, publish workflow, pagination, problem-details shape, idempotency replay                                                                                                                                                                                                                                                                                                                            |
| Contract        | Zod round-trip + OpenAPI snapshot diff                                                              | catches breaking API changes before the frontend does                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Web unit        | Vitest + RTL + MSW                                                                                  | query modules (200 / 404→`notFound()` / 500 / **contract drift→502**), server actions, cva variants, JSON-LD builders, **the token contrast matrix**                                                                                                                                                                                                                                                                                                                                                         |
| E2E             | Playwright (chromium + webkit + Pixel 7 + iPhone 14)                                                | home→persona→book full wizard against a seeded API; play persists across navigation; lightbox via intercepting route **and** hard-nav deep link; back-button correctness; admin login→create→schedule→preview→publish→appears publicly (**tests the `revalidateTag` loop end to end**); a `javaScriptEnabled: false` smoke run proving every page renders and every form still submits; **a link-crawl asserting 200 on every internal href** (closing the legacy dead-footer-link class of bug permanently) |
| A11y            | `@axe-core/playwright` all routes + `vitest-axe` components                                         | zero serious/critical blocks merge                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Visual          | Playwright `toHaveScreenshot`, 3 viewports × 4 persona themes, animations disabled, fonts preloaded | Chromatic rejected on cost; revisit if the team grows                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Storybook       | Storybook 8 for `packages/ui` **only**                                                              | 4 themes × states is a combinatorial surface painful to review in-app; it's also the a11y + visual-regression harness and the token documentation. App compositions are not storied (e2e covers them)                                                                                                                                                                                                                                                                                                        |
| Perf            | Lighthouse CI (5 runs, median) on preview deploys + `size-limit` + `@next/bundle-analyzer` artifact | >5% regression on any budget fails the PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Coverage        | —                                                                                                   | 85% `packages/*` and API services · **100% `auth/`** (anything less on auth is theatre) · 70% `apps/web/src/{lib,server,components}`                                                                                                                                                                                                                                                                                                                                                                         |

**ESLint 9 flat config** with typescript-eslint (type-checked), react/react-hooks, `@next`, strict `jsx-a11y`, tailwind v4 class sorting, `import-x` boundary rules, vitest, playwright — plus **custom local rules**: no `'use client'` in `page.tsx`/`layout.tsx` · no raw color literals in `apps/web` · no `<img>`/raw `<a href="http">` · `packages/ui` may not import from `apps/*` · `server-only` modules unimportable from `'use client'` files · Prisma only in repositories · no `$queryRawUnsafe`. Prettier 3 + `prettier-plugin-tailwindcss`, Husky + lint-staged, commitlint/Conventional Commits, Changesets for `packages/*`.

**CI** (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile` → `turbo db:generate` → `pnpm check:env` (**`.env.example` ↔ `env.schema.ts` key parity**, so a new var can't be added to code without being documented) → `turbo lint typecheck test --filter='...[origin/main]'` → `turbo test:e2e --filter=api` → `turbo build` → `db:migrate:check` (`prisma migrate diff --exit-code` — non-zero means someone edited the schema without migrating) → Playwright ×3 shards → Lighthouse CI on the Vercel preview → axe report → bundle diff comment. A Neon branch `preview/pr-N` is created per PR so **migrations rehearse against production-shaped data** and dropped on merge. `deploy-api.yml` on `main`: Docker build → `railway up` → pre-deploy `prisma migrate deploy` + `seed:system` → `/health/ready` check → Sentry release + sourcemaps. Vercel builds `web`/`admin` with `turbo-ignore` so an API-only change doesn't rebuild the frontends.

**Migration rules:** never edit a merged migration; destructive changes are **expand/contract across two deploys** (add nullable + backfill + dual-write → switch reads → drop in a later release); any migration touching >1000 rows gets a `-- @manual` data script run separately from the DDL.

**Seeds, three layers:** `seed:system` (idempotent `upsert` on natural keys, runs in **every** environment including production: permissions, 3 system roles, the `SiteSettings` singleton, the 4 `Persona` rows keyed by `PersonaKey`, canonical genres) · `seed:content` (dev/preview: the harvested legacy data — 4 personas with real bios/colors/socials, ~20 tracks with real `soundcloudTrackId`s, `gigs[]` strings parsed into `Venue` + `Event` + `Program` rows, real testimonials only, and `public/images/*` uploaded once to a `djf-dev/` namespace with ids checked in) · `seed:demo` (dev only, `faker.seed(20260910)` for stable screenshots: 200 events, 60 inquiries across the pipeline, 500 page views, 40 posts). `seed:admin` refuses to run in production if a `SUPER_ADMIN` exists.

---

## 8. Deployment topology

```
   djfelicitous.com ──────► Vercel: apps/web    (static + ISR + PPR, edge cache)
   admin.djfelicitous.com ► Vercel: apps/admin  (force-dynamic, no-store)
                                   │ server-side tagged fetch
   api.djfelicitous.com ──► Railway: apps/api   (NestJS container, 1 replica,
                                   │             in-process cron + advisory locks)
                    ┌──────────────┼──────────────┐
            Neon Postgres      Cloudinary       Resend
            (ap-southeast-1)   (media CDN)      (email)
                    └──── Sentry + Railway log drain (Pino JSON) ────┘
```

Railway + Neon both in **Singapore (`ap-southeast-1`)** — closest to Bangalore, single-digit-ms API↔DB and ~40ms API↔user. Local dev uses **Docker Postgres, not a Neon dev branch**: offline-capable, instant `pnpm db:reset`, no shared-branch clobbering. Mailpit catches outbound mail locally instead of hitting Resend.

---

## 9. Phased build plan

Each phase has hard exit criteria. **Execution in this session stops after Phase 1.**

| #      | Phase                          | Exit criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**  | **Foundations**                | Harvest `djfelicitous/src/data/*.ts` + `public/images/*` into `packages/db/seed/data/`, **then delete `djfelicitous/`**. Workspace + Turborepo + shared configs + Docker Compose + `.env.example`s + CI skeleton. `pnpm install && pnpm turbo lint typecheck build` green on a clean clone; `docker compose up -d` yields a reachable Postgres.                                                                                                                                                    |
| **1**  | **Data layer**                 | Full schema from §4, initial migration, soft-delete + audit Prisma extensions, the raw-SQL migration (pg_trgm, partial indexes, tsvector, singleton CHECK), all three seeds. `migrate reset && seed` produces 4 personas, ~20 tracks, ~30 events, programs, venues, gear, experience, 3 roles, 1 admin. Integration tests prove soft delete hides rows and that `delete` never issues a real `DELETE`. `migrate:check` reports zero drift.                                                         |
| **2**  | API skeleton & global concerns | `/health/ready` 200 with DB + Cloudinary checks; `/api/docs` renders; a thrown error returns valid `application/problem+json` with a `requestId` that appears in the logs; a 30s handler is cut at 15s.                                                                                                                                                                                                                                                                                            |
| **3**  | Auth & RBAC                    | Full e2e matrix green; `auth/` at 100% coverage; `AuditLog` rows for every auth action.                                                                                                                                                                                                                                                                                                                                                                                                            |
| **4**  | Core content CRUD              | Personas/Events/Venues/Tracks/Playlists/Releases + a shared `BaseContentService` (publish/unpublish/archive/restore/reorder/`publishedWhere()`). Every resource: list (cursor+offset, sort, filter, include, fields), read-by-slug, admin CRUD, publish workflow. `GET /personas/:slug/page` returns the full landing payload at ≤8 queries. OpenAPI snapshot committed.                                                                                                                           |
| **5**  | Media pipeline                 | A browser-signed upload lands in the correct server-decided folder, produces a `MediaAsset` with correct bytes/dimensions/`blurDataUrl`, and its `t_djf_card`/`t_djf_og` derivatives already exist. Deleting a referenced asset 409s with the referencing list. The sweeper removes a 31-day-old soft-deleted asset from DB + Cloudinary. Background video and an audio track both round-trip with peaks.                                                                                          |
| **6**  | Remaining content + engagement | Testimonials, Services, Brands, Stats, FAQ, PressKit, **Gear**, **Experience**, **Programs**, Blog, StaticPages, Settings, Redirects, Sitemap, Seo; Inquiries (pipeline, notes, spam scoring, Turnstile) + Newsletter (double opt-in) + all email templates + the retry cron. Submitting the form creates `INQ-YYYY-NNNN`, returns 201 in <100ms, and delivers both emails. `GET /sitemap` lists exactly the published indexable URLs. The press-kit PDF generates and downloads via a signed URL. |
| **7**  | Web shell + data + SEO core    | Every route prerendered; **every footer link resolves 200** (link-crawl test); `generateMetadata` on all patterns; dynamic OG images; split sitemaps with per-entity lastmod; robots; the full JSON-LD graph validated by Google Rich Results with zero errors; all legacy 301s verified in e2e. Lighthouse ≥95 with motion off.                                                                                                                                                                   |
| **8**  | Conversion                     | A real inquiry lands in Postgres + email + WhatsApp handoff; funnel analytics firing; the form passes axe **and** the no-JS submit test.                                                                                                                                                                                                                                                                                                                                                           |
| **9**  | Media & player                 | LCP ≤2.0s p75 on `/` and `/[persona]` throttled-mobile; the mini-player survives 5 navigations; the lightbox passes keyboard + gesture + deep-link tests; `size-limit` gates enforced.                                                                                                                                                                                                                                                                                                             |
| **10** | Cinematic + signature motion   | Every item in §5.6 shipped **with its documented fallback**; forced `prefers-reduced-motion` and forced `saveData` runs both render a complete, beautiful, ≤60KB-JS page; INP ≤150ms; no budget regressions.                                                                                                                                                                                                                                                                                       |
| **11** | Admin                          | The DJ publishes a new track, event, playlist, and gallery set end-to-end without a developer in a recorded usability session; publish → live in <10s; RBAC verified server-side.                                                                                                                                                                                                                                                                                                                  |
| **12** | Hardening & launch             | All gates green; manual NVDA + VoiceOver pass; nonce CSP with no `unsafe-inline`; k6 load test (200rps on `/personas/:slug/page`, p95 <200ms); Railway/Vercel/Neon provisioned; DNS + SPF/DKIM/DMARC; **a completed restore drill**; uptime monitors; Sentry alerts; runbooks (incident, secret rotation, restore, DSAR); `SWAGGER_ENABLED=false`; 2FA admin login verified; WhatsApp/Instagram/LinkedIn OG previews checked (WhatsApp matters most in India).                                     |
| **13** | Growth                         | Location + venue landing pages, blog engine, `/search`, post-event testimonial collection flow, Spotify/SoundCloud API sync for live play counts, i18n activation, PWA offline shell for press kit + rider, Upstash + BullMQ if triggered, A/B testing the booking CTA.                                                                                                                                                                                                                            |

---

## 10. `docs/` — the durable masterplan

Written **first**, in Phase 0, because later sessions read it before touching code.

```
docs/
├─ README.md                      # entry point: how to read these docs, in what order
├─ 00-overview.md                 # product, audience, personas, goals, non-goals, glossary
├─ 01-decisions/                  # ADRs, numbered, immutable once accepted
│  ├─ 0001-monorepo-turborepo.md      0002-separate-admin-app.md
│  ├─ 0003-nestjs-hand-rolled-auth.md 0004-zod-contracts-over-openapi-codegen.md
│  ├─ 0005-neon-pooled-no-accelerate.md 0006-no-redis-at-launch.md
│  ├─ 0007-railway-for-api.md          0008-cloudinary-signed-direct-upload.md
│  ├─ 0009-persona-dynamic-route.md    0010-tiptap-json-storage.md
│  ├─ 0011-react-pdf-over-puppeteer.md 0012-radix-vendored-shadcn.md
│  └─ 0013-cinematic-video-with-motiongate-fallbacks.md
├─ 02-architecture/
│  ├─ system-overview.md          # the topology diagram + request lifecycles
│  ├─ backend.md                  # §3 in full: modules, conventions, guards order
│  ├─ frontend.md                 # §5 in full: app tree, rendering matrix, data layer
│  ├─ admin.md                    # §6
│  ├─ data-model.md               # §4: every model, why each field exists, ERD
│  ├─ api-conventions.md          # §3.7: pagination, filtering, errors, ETag, idempotency
│  ├─ caching-and-revalidation.md # the tag taxonomy + the api→web HMAC webhook contract
│  ├─ media-pipeline.md           # §3.6: folders, named transforms, upload flow, deletion
│  ├─ auth-and-rbac.md            # §3.5: token lifecycle, permission matrix
│  └─ seo.md                      # §5.8: metadata, JSON-LD graph, sitemaps, local SEO
├─ 03-design-system/
│  ├─ tokens.md                   # the @theme contract; how to add a token (and when not to)
│  ├─ persona-theming.md          # data-theme + @property interpolation + CMS accents
│  ├─ typography.md  components.md
│  ├─ motion.md                   # the MotionGate contract; every experience + its fallback
│  └─ accessibility.md            # §5.9 as an enforceable checklist
├─ 04-conventions/
│  ├─ code-style.md               # naming, file layout, the custom lint rules and their why
│  ├─ git-workflow.md  commit-conventions.md
│  ├─ testing.md                  # what belongs at which layer; coverage gates
│  └─ definition-of-done.md       # the per-PR checklist
├─ 05-operations/
│  ├─ local-setup.md              # clone → running in <10 min
│  ├─ environments.md  env-vars.md    # the authoritative env inventory
│  ├─ migrations.md               # workflow + expand/contract rules
│  ├─ deployment.md  observability.md
│  ├─ security.md  backups.md
│  └─ runbooks/{incident,secret-rotation,restore,dsar}.md
├─ 06-roadmap/
│  ├─ phases.md                   # §9 as the canonical phase table
│  ├─ STATUS.md                   # ← THE LIVE TRACKER. Current phase, done/in-progress/
│  │                              #   blocked, exit-criteria checkboxes, last updated.
│  │                              #   Every session updates this before finishing.
│  └─ backlog.md
└─ 07-content/
   ├─ content-model-guide.md      # for the DJ: what each content type is for
   ├─ legacy-audit.md             # the old site's failures + the 301 map + what was harvested
   └─ brand.md                    # voice, palette rationale, logo usage, what NOT to claim
                                  #   (explicitly: no fabricated venues/testimonials)
```

`docs/README.md` opens with a **mandatory preamble for AI agents**: read `00-overview`, `06-roadmap/STATUS.md`, and the relevant `02-architecture` doc before writing code; the architecture is decided — deviations require a new ADR in `01-decisions/`, not an ad-hoc choice; update `STATUS.md` before finishing. `CLAUDE.md` at the repo root points at it and restates the hard invariants (server-first, one token source, contracts-first, repository-only Prisma, alt-text required, no fabricated content).

---

## 11. Verification

**Phase 0:**

```powershell
pnpm install
pnpm turbo lint typecheck build      # green from a clean clone
docker compose up -d
docker compose ps                     # postgres healthy
pnpm check:env                        # .env.example ↔ env.schema.ts parity
```

Then confirm `docs/` is complete and `djfelicitous/` is gone while `packages/db/seed/data/` holds the harvested personas, tracks, gigs, testimonials, and image manifest.

**Phase 1:**

```powershell
pnpm --filter @dj/db exec prisma validate
pnpm --filter @dj/db exec prisma migrate reset --force
pnpm --filter @dj/db seed
pnpm --filter @dj/db exec prisma studio      # eyeball 4 personas, ~20 tracks, ~30 events,
                                              # programs, venues, gear, experience, roles, admin
pnpm --filter @dj/db test                     # Testcontainers integration suite
pnpm db:migrate:check                         # zero schema/migration drift
```

Integration tests must assert: a `delete` issues `UPDATE ... SET deleted_at` and never `DELETE`; default reads exclude soft-deleted rows; `createdBy`/`updatedBy` populate from the request context; the `site_settings` singleton CHECK rejects a second row; `@@unique([name, city])` rejects a duplicate venue; the partial and trigram indexes exist (`SELECT indexname FROM pg_indexes`).

**Not verified in this session** (later phases): API boot, auth flows, upload signing, the revalidation loop, Lighthouse, axe, Playwright.

---

## 12. Explicit non-goals for this session

- No `git init`, no commits, no remote — the user handles version control.
- No feature implementation past Phase 1 (no controllers, no pages, no components beyond what scaffolding generates).
- No production provisioning (Neon project, Railway service, Vercel projects, Cloudinary account, Resend domain) — `.env.local` files are created with documented placeholder variables for the user to fill.
- No content authoring beyond seeding harvested legacy data. **Fabricated testimonials and venue claims from the old site are deliberately not carried over.**
- `djfelicitous/.env.local` contains a live-looking Resend key — flag it for rotation; do not reuse it.
