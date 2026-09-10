# API conventions

`/api/v1/*`, URI-versioned. **Status: not yet built** — this is the Phase 2–4
specification.

## Resource naming

**Public reads by slug, admin writes by id.** Slugs change; ids do not.

```
GET  /api/v1/personas
GET  /api/v1/personas/:slug
GET  /api/v1/personas/:slug/page          # aggregate, one round trip
GET  /api/v1/tracks | /playlists | /releases | /events | /programs | /venues
GET  /api/v1/events?when=upcoming&city=Bengaluru
GET  /api/v1/galleries/:slug | /videos | /testimonials | /services | /faqs
GET  /api/v1/press-kit | /gear | /experience | /posts | /pages/:slug
GET  /api/v1/settings                     # public subset only
GET  /api/v1/redirects                    # consumed by web middleware
GET  /api/v1/sitemap                      # flat feed for app/sitemap.ts
POST /api/v1/inquiries                    # 3/hour/IP + Turnstile + honeypot
POST /api/v1/newsletter/subscribe
POST /api/v1/analytics/page-view          # fire and forget, 204
```

Admin is `/api/v1/admin/<resource>` with full CRUD plus:

- `PATCH :id/publish`, `:id/unpublish`, `:id/archive`, `POST :id/restore`
- `PATCH reorder` — takes `[{id, sortIndex}]` in **one transaction**. Drag and
  drop produces a whole permutation, not N independent updates.
- `GET :id/audit`

## Response shapes

Single resources are **bare** — no envelope. Envelope-everything hurts typed
client DX for no gain.

Collections carry metadata:

```jsonc
{
  "data": [/* ... */],
  "meta": {
    "pagination": {
      "mode": "cursor",
      "limit": 20,
      "nextCursor": "eyJzaSI6MTIsImlkIjoiY20weC4uLiJ9",
      "hasMore": true,
    },
    "sort": "-startsAt",
    "filters": { "when": "upcoming" },
  },
}
```

## Pagination — both modes, on purpose

- **Offset** for admin tables, which need "page 7 of 23".
- **Cursor** for public infinite lists, which need stability while new content
  is published.

Cursors are opaque base64 of the **full sort tuple plus an id tiebreaker** —
never a bare id, which breaks on any non-unique sort order. `X-Total-Count` is
set in offset mode only; a `count()` on every cursor page is wasted work.

## Filtering — explicit schemas, not a generic DSL

Deliberately **not** `?filter[field][op]=value`. A generic filter DSL is an
unbounded query surface with a denial-of-service and index-miss profile.

Each resource declares a Zod query schema:

```ts
export const EventQuerySchema = PaginationSchema.extend({
  when: z.enum(['upcoming', 'past', 'all']).default('all'),
  personaSlug: z.string().optional(),
  kind: z.nativeEnum(EventKind).optional(),
  city: z.string().max(80).optional(),
  q: z.string().max(120).optional(),
  sort: sortSchema(['startsAt', 'title', 'sortIndex', 'createdAt']).default('-startsAt'),
  include: includeSchema(['persona', 'venue', 'lineup', 'flyer', 'gallery']),
  fields: z.string().optional(),
});
```

- `sortSchema(allowlist)` guarantees **every sortable column has an index**.
- `includeSchema(allowlist)` maps each key to a fixed Prisma include fragment,
  capped at depth 2. This is the N+1 and over-fetch guard.
- Unknown `fields=` is a **422**, never a silent ignore.

## Errors — RFC 9457

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

Content type is `application/problem+json`. `errors[].pointer` is a **JSON
Pointer**, so admin forms map errors to fields mechanically instead of
string-matching messages. `requestId` appears in the logs, which is what makes
a user-reported error traceable.

Problem `type` URIs resolve to real documentation under `/api/docs/problems`.

## Idempotency

`Idempotency-Key` on all POSTs. A replay returns the stored response with
`Idempotency-Replayed: true`; the same key with a different body is a 409
`IDEMPOTENCY_KEY_REUSED`.

`POST /inquiries` has a second layer: an `(email, eventDate, within 10 min)`
dedupe, for clients that send no header at all. A double-tapped submit button
must not create two enquiries.

## Caching headers

Strong ETag = sha1 of the stable-stringified body; `If-None-Match` returns 304.

| Scope                     | `Cache-Control`                                      |
| ------------------------- | ---------------------------------------------------- |
| Public content            | `public, s-maxage=300, stale-while-revalidate=86400` |
| `/settings`, `/redirects` | `public, s-maxage=3600`                              |
| `/sitemap`                | `public, s-maxage=1800`                              |
| Admin, and every non-GET  | `no-store`                                           |

## Rate limits

| Endpoint                       | Limit                                         |
| ------------------------------ | --------------------------------------------- |
| Global                         | 120/min/IP                                    |
| `POST /auth/login`             | 10/15min/IP                                   |
| `POST /inquiries`              | 3/hour/IP + Turnstile + honeypot + spam score |
| `POST /analytics/page-view`    | 60/min/IP                                     |
| `POST /media/upload-signature` | 30/min/user                                   |
