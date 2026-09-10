# System overview

## Topology

```
   djfelicitous.com ──────► Vercel: apps/web    (static + ISR + PPR, edge cache)
   admin.djfelicitous.com ► Vercel: apps/admin  (force-dynamic, no-store)
                                   │ server-side tagged fetch (x-api-key)
   api.djfelicitous.com ──► Railway: apps/api   (NestJS container, 1 replica,
                                   │             in-process cron + advisory locks)
                    ┌──────────────┼──────────────┐
            Neon Postgres      Cloudinary       Resend
            (ap-southeast-1)   (media CDN)      (email)
                    └──── Sentry + Railway log drain (Pino JSON) ────┘
```

Railway and Neon are both in **Singapore** — closest region to Bengaluru,
giving single-digit-millisecond API↔database latency and roughly 40ms
API↔user.

## Request lifecycles

### A visitor loads a persona page

1. Vercel edge serves the prerendered HTML. Usually nothing else happens.
2. On a cache miss, the server component calls `getPersona(slug)`, which hits
   `GET /api/v1/personas/:slug/page` with `next: { tags: ['persona:tnt'] }`.
3. The API returns the whole page payload in **one** database round trip.
4. The response is validated against its Zod contract. Drift throws a 502 with
   a logged diff rather than rendering `undefined`.
5. `data-theme` and the persona's CMS accent colour are set server-side, so the
   correct accent is in the first paint with no flash.
6. Heavy visuals (WebGL shader, 3D scenes) mount later, over a CSS fallback
   that was always in the HTML.

**The browser never talks to the API on public pages.** That keeps the API key
server-side, avoids CORS entirely, and keeps the origin cacheable.

### The artist publishes a track

1. Admin `PATCH /api/v1/admin/tracks/:id/publish`.
2. `TracksService` flips `status`, stamps `publishedAt`, writes an `AuditLog`
   row, and emits `content.changed`.
3. `RevalidationService` maps the entity to tags and POSTs an HMAC-signed
   webhook to `apps/web`.
4. `app/api/revalidate/route.ts` verifies the signature and timestamp, then
   calls `revalidateTag`.
5. The public page reflects the change within seconds. The admin UI shows
   "Live in ~5s", because that round trip is user-visible trust.

Failures here are retried and never block the write. See
[`caching-and-revalidation.md`](caching-and-revalidation.md).

### Someone submits a booking enquiry

1. A **server action** in `apps/web` — no client bundle on the submit path, and
   it works without JavaScript.
2. Zod validation (the same schema the API uses), rate limit, honeypot,
   Turnstile.
3. `POST /api/v1/inquiries` → row written with an `INQ-2026-NNNN` reference,
   returns 201 in about 40ms.
4. `inquiry.created` fires. **Email sending is not awaited in-request.** A
   handler sends the notification and autoresponder and stamps `notifiedAt`.
5. Redirect to `/book/thanks` with a prefilled WhatsApp deep link as the fast
   path.
6. A nightly cron retries anything still unnotified, because a dropped
   notification costs a booking.

### The artist uploads a photo

1. Admin requests `POST /api/v1/media/upload-signature`. **The server decides
   the folder** — the client cannot write outside its taxonomy.
2. The browser uploads **directly to Cloudinary**. It never touches our compute.
3. Admin POSTs the result to `POST /api/v1/media`, and the API **re-reads
   authoritative metadata from Cloudinary** rather than trusting the client.
4. `blurDataUrl`, `blurhash` and `dominantColor` are computed and stored, so
   `placeholder="blur"` costs nothing at runtime.
5. Alt text is required before the asset can be attached to published content.

See [`media-pipeline.md`](media-pipeline.md) and
[ADR 0008](../01-decisions/0008-cloudinary-signed-direct-upload.md).

## Trust boundaries

| Boundary                   | Control                                                    |
| -------------------------- | ---------------------------------------------------------- |
| Public browser → web       | No secrets in the client. No API access.                   |
| Web server → API           | `x-api-key`, server-side only                              |
| Admin browser → API        | Access JWT in memory + refresh cookie scoped to `admin.`   |
| API → database             | Pooled Neon; DDL only over `DIRECT_URL`                    |
| Admin browser → Cloudinary | Short-lived server-signed params; folder fixed server-side |
| API → web (revalidate)     | HMAC over `timestamp.body`, ±5 min window                  |

The admin session cookie is scoped to `admin.djfelicitous.com`, so an XSS on a
public marketing page cannot reach it
([ADR 0002](../01-decisions/0002-separate-admin-app.md)).

## Where state lives

| State                         | Home                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| All content                   | Neon Postgres, via Prisma                                    |
| Images, video, audio, PDFs    | Cloudinary (`MediaAsset` holds the metadata)                 |
| Rendered pages                | Next.js Data Cache + Vercel edge                             |
| Admin sessions                | `refresh_tokens` table; access tokens are stateless          |
| Audio player queue            | Zustand, client only, deliberately not persisted server-side |
| Cookie consent, reduce-motion | Cookie, read server-side so it applies before first paint    |
