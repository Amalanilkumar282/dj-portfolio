# Backend — `apps/api` (NestJS 11)

Owns the database, the business rules and the security boundary. Deployed as a
persistent container on Railway ([ADR 0007](../01-decisions/0007-railway-for-api.md)).

**Status: not yet built.** This is the Phase 2 specification. See
[`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md).

---

## Feature-module convention

Every feature module has the same shape. Uniformity is what lets a generic
`BaseContentService` and a reusable admin editor exist at all.

```
modules/events/
├─ events.module.ts
├─ events.controller.ts          # public reads. @Public(), cacheable.
├─ events.admin.controller.ts    # writes. Class-level guards.
├─ events.service.ts             # business rules, transactions, domain events
├─ events.repository.ts          # the ONLY place Prisma is touched
├─ dto/{create,update,query}-event.dto.ts   # createZodDto from @dj/contracts
├─ mappers/event.mapper.ts       # toPublic() / toAdmin(), pure functions
├─ entities/event.entity.ts      # Swagger response class
└─ __tests__/
```

### Why public and admin controllers are separate files

Not per-route guards on one controller — **two files**. The whole
`*.admin.controller.ts` carries class-level
`@UseGuards(JwtAccessGuard, PermissionsGuard)`, and the public one carries
`@Public()`.

This makes the security boundary structural. The global `JwtAccessGuard` denies
by default and `@Public()` opts out, so nothing is ever protected by accident
of omission — the failure mode is a locked endpoint, not an open one.

### Enforced boundaries

ESLint, not convention:

| Rule                                                                         | Why                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Prisma only in `*.repository.ts` and `infra/`                                | One data-access seam per aggregate. Without it, the include-allowlist and N+1 guards are unenforceable. |
| Controllers never import `@prisma/client`                                    | Keeps transport separate from persistence.                                                              |
| Cross-module access via the other module's **service**, never its repository | Repositories assume their aggregate's invariants.                                                       |
| No `$queryRawUnsafe` / `$executeRawUnsafe`                                   | The legitimate raw sites use `Prisma.sql` tagged templates, which parameterise.                         |

Mappers are pure, and there are two per aggregate where the shapes diverge:
`toPublic()` omits internal fields, `toAdmin()` includes them.

---

## Module inventory

**Infra / global** — `ConfigModule` (Zod-validated, fail-fast), `LoggerModule`
(nestjs-pino), `PrismaModule`, `CacheModule`, `CloudinaryModule`, `MailModule`,
`RevalidationModule`, `HealthModule`, `ThrottlerModule`, `ScheduleModule`,
`EventEmitterModule`.

**Platform** — `AuthModule`, `UsersModule`, `RbacModule`, `AuditModule`.

**Content** — `PersonasModule`, `GenresModule`, `TracksModule`,
`PlaylistsModule`, `ReleasesModule`, `EventsModule`, `VenuesModule`,
`ProgramsModule`, `MediaModule`, `GalleriesModule`, `VideosModule`,
`TestimonialsModule`, `ServicesModule`, `BrandsModule`, `StatsModule`,
`FaqModule`, `PressKitModule`, `GearModule`, `ExperienceModule`, `BlogModule`,
`StaticPagesModule`.

**Engagement** — `InquiriesModule`, `NewsletterModule`.

**Site** — `SettingsModule`, `SeoModule`, `RedirectsModule`, `SitemapModule`,
`AnalyticsModule`.

**Ops** — `JobsModule`.

---

## Global concerns

`main.ts`: `patchNestJsSwagger()`, Pino logger, `trust proxy` (Railway sits
behind an edge), helmet, compression, cookie-parser,
`setGlobalPrefix('api', { exclude: ['health*'] })`,
`enableVersioning({ type: URI, defaultVersion: '1' })` → `/api/v1/*`, CORS with
`credentials: true`, `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
true })`, `express.json({ limit: '256kb' })`, `enableShutdownHooks()`, Swagger
at `/api/docs` disabled in production.

### Provider order is the security boundary

Registered in `app.module.ts`, and **the order matters**:

```
APP_GUARD:        Throttler → JwtAccess → Permissions
APP_FILTER:       Sentry → Prisma → AllExceptions
APP_INTERCEPTOR:  RequestContext → Timeout → Idempotency
                  → HttpCache → Audit → ClassSerializer
```

- Throttler first, so a flood is rejected before any auth work is done.
- `RequestContext` first among interceptors, because everything downstream —
  audit stamping included — reads from the `AsyncLocalStorage` store it opens.
- `ClassSerializer` last, so it sees the final shape.

`ValidationPipe` uses `forbidNonWhitelisted`, so an unknown property is a 422
rather than being silently dropped. Silent dropping is how frontends ship bugs
that nobody can reproduce.

### Config fails fast

`config/env.schema.ts` is a Zod schema; boot throws on invalid env. This is
deliberate: a container that starts with a missing `RESEND_API_KEY` and
silently drops booking emails is a business bug, not a config bug.

### Logging

Pino with `genReqId` (honours an inbound `x-request-id`, else generates one and
echoes it in the response), `customProps` adding `userId` and `ip`, and
**redaction** of `authorization`, `cookie`, `set-cookie`, `password`,
`currentPassword` and `totp`. `/health` is excluded from access logging.

The same `AsyncLocalStorage` store backs `RequestContextService`, which is what
`@dj/db`'s audit extension reads — so audit attribution needs zero plumbing
through service signatures.

### Errors — RFC 9457

`application/problem+json` throughout. Full shape in
[`api-conventions.md`](api-conventions.md). Prisma mapping: `P2002 → 409` with
a JSON Pointer from `meta.target`, `P2025 → 404`, `P2003 → 409`.

### Health

`/health` is liveness (no dependency checks — a failing database should not get
the container killed and restarted in a loop). `/health/ready` is readiness:
database ping, Cloudinary reachability, heap and disk.

---

## Avoiding N+1

Three techniques, in order of preference:

1. **`relationJoins`** (enabled in the generator) makes Prisma emit real
   `LATERAL JOIN`s for `include` instead of separate queries.
2. **Explicit include allowlists** — the API physically cannot be asked for a
   deep graph. See [`api-conventions.md`](api-conventions.md).
3. **Aggregate page endpoints** for known page shapes:
   `GET /api/v1/personas/:slug/page` returns persona, genres, socials, featured
   tracks, playlists, upcoming events, testimonials, gallery, stats, videos,
   brands, gear and SEO from one `findUnique({ include })` plus one
   `$transaction` of counts.

   This is the backend-for-frontend concession that keeps the public site at
   roughly one database round trip per page. It is a deliberate exception to
   REST purity, and it is worth it.

A dev-only `$on('query')` counter warns above 8 queries per request — an N+1
canary that the e2e suite enforces in CI.

---

## Background jobs

`@nestjs/schedule` cron, in-process. No BullMQ, no Redis
([ADR 0006](../01-decisions/0006-no-redis-at-launch.md)).

| Job                  | Schedule (IST) |
| -------------------- | -------------- |
| `publish-scheduled`  | every 5 min    |
| `mark-past-events`   | hourly         |
| `media-orphan-sweep` | 03:15          |
| `prune-tokens`       | 03:30          |
| `analytics-rollup`   | 03:45          |
| `retry-failed-mail`  | 04:00          |
| `inquiry-digest`     | Mon 09:00      |
| `revalidate-all`     | Sun 05:00      |

**Every job wraps in `pg_try_advisory_lock(hashtext($1))`.** Three lines that
stop a second replica from double-sending the artist's booking emails. Add it
when you write the job, not when you scale.

BullMQ arrives only if a job exceeds ~10s or a newsletter send exceeds ~500
recipients.

---

## Email

Resend, with React Email templates previewable via `email dev`.

**Sending is never awaited in-request.** `POST /inquiries` writes the row,
emits `inquiry.created`, and returns 201 in roughly 40ms. An `@OnEvent` handler
sends the notification and autoresponder and stamps `notifiedAt`. The
`retry-failed-mail` cron rescans `notifiedAt IS NULL AND createdAt > now() -
24h`.

That retry loop is not optional. A dropped notification email costs the artist
a booking, which is the exact failure the legacy site had.
