# Caching and revalidation

**The single most important integration in the system.** The artist edits a
persona in admin and the public page must update within seconds, with no
redeploy. If this breaks, the project has failed its central requirement.

**Status: not yet built.** Phase 7 specification.

---

## Three cache layers

| Layer                   | Mechanism                                    | TTL                     | Invalidated by                                   |
| ----------------------- | -------------------------------------------- | ----------------------- | ------------------------------------------------ |
| L1 — CDN / browser      | `Cache-Control` + ETag, Vercel edge          | 5 min s-maxage, 24h SWR | 304 on `If-None-Match`                           |
| L2 — Next.js Data Cache | `fetch(url, { next: { tags, revalidate } })` | 1h                      | **`revalidateTag` webhook — the real mechanism** |
| L3 — API in-process     | `cache-manager` LRU, max 500, 60s            | 60s                     | per-prefix wipe on domain events                 |

L2 does the real work. It absorbs virtually all public read traffic, which is
why the API sees close to zero requests per second in steady state — and why
Redis is not needed ([ADR 0006](../01-decisions/0006-no-redis-at-launch.md)).

---

## Cache-tag taxonomy

Lives in `packages/contracts/src/cache-tags.ts` and is **mirrored exactly** in
the API's `TAG_MAP`. Keeping one definition on each side of the boundary is
what makes webhook payloads trivially derivable and stops the two drifting.

```ts
export const tags = {
  all: 'all',
  home: 'home',
  personas: 'personas',
  persona: (s: string) => `persona:${s}`,
  tracks: 'tracks',
  track: (s: string) => `track:${s}`,
  tracksByPersona: (s: string) => `tracks:persona:${s}`,
  playlists: 'playlists',
  playlist: (s: string) => `playlist:${s}`,
  albums: 'albums',
  album: (s: string) => `album:${s}`,
  eventsUpcoming: 'events:upcoming',
  eventsPast: 'events:past',
  event: (s: string) => `event:${s}`,
  programs: 'programs',
  program: (s: string) => `program:${s}`,
  venues: 'venues',
  venue: (s: string) => `venue:${s}`,
  gallery: 'gallery',
  galleryItem: (id: string) => `gallery:${id}`,
  videos: 'videos',
  video: (id: string) => `video:${id}`,
  posts: 'posts',
  post: (s: string) => `post:${s}`,
  services: 'services',
  service: (s: string) => `service:${s}`,
  testimonials: 'testimonials',
  faqs: 'faqs',
  gear: 'gear',
  experience: 'experience',
  pressKit: 'press-kit',
  page: (s: string) => `page:${s}`,
  settings: 'settings',
  nav: 'nav',
  sitemap: 'sitemap',
} as const;
```

**Rule: query modules own their tags; pages never pass tags themselves.** A
page that hand-writes a tag string is a page that will be forgotten when the
tag changes.

---

## The webhook

### API side

Services emit a domain event rather than calling the webhook directly, so
revalidation is decoupled from business logic:

```ts
this.events.emit('content.changed', {
  entity: 'persona',
  id: persona.id,
  slug: persona.slug,
  action: 'publish',
  personaSlug: persona.slug,
} satisfies ContentChangedEvent);
```

`RevalidationService` maps entity → tags and POSTs to the web app:

```ts
const TAG_MAP: Record<EntityName, (e: ContentChangedEvent) => string[]> = {
  persona: (e) => ['personas', `persona:${e.slug}`, 'sitemap', 'nav'],
  event: (e) => [
    'events:upcoming',
    'events:past',
    `event:${e.slug}`,
    e.personaSlug ? `persona:${e.personaSlug}` : '',
    'sitemap',
  ],
  track: (e) => [
    'tracks',
    `track:${e.slug}`,
    e.personaSlug ? `tracks:persona:${e.personaSlug}` : '',
  ],
  settings: () => ['settings', 'nav', 'footer'],
  // ...
};
```

Signed with HMAC over `${timestamp}.${body}`:

```ts
const ts = Date.now().toString();
const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
```

Retried three times with exponential backoff, and **never blocking the admin
write**. The artist's save must not fail because Vercel hiccuped.

### Web side — `app/api/revalidate/route.ts`

```ts
export async function POST(req: Request) {
  const raw = await req.text();
  const ts = req.headers.get('x-djf-timestamp') ?? '';
  const sig = req.headers.get('x-djf-signature') ?? '';

  // The timestamp window is what kills replay; a bare bearer secret would not.
  if (Math.abs(Date.now() - Number(ts)) > 300_000) return problem(401, 'stale-signature');

  const expected = createHmac('sha256', process.env.REVALIDATE_SECRET!)
    .update(`${ts}.${raw}`)
    .digest('hex');
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return problem(401, 'bad-signature');
  }

  const { tags = [], paths = [] } = JSON.parse(raw) as RevalidatePayload;
  tags.forEach(revalidateTag);
  paths.forEach((p) => revalidatePath(p));
  return Response.json({ revalidated: { tags, paths }, at: Date.now() });
}
```

HMAC **with a timestamp window**, not a static bearer token: the window is what
makes a captured request unusable later. `timingSafeEqual` because a
short-circuiting string compare leaks the signature a byte at a time.

### Backstop

A weekly `revalidate-all` cron. Webhooks fail; a site that quietly serves
month-old content is worse than one that refreshes slowly.

---

## Rendering strategy per route

| Route                                                            | Strategy                                                        | Tags                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                                                              | Static shell + PPR; upcoming-gigs slot streamed, ISR 300s       | `home, personas, events:upcoming, tracks:featured, testimonials` |
| `/[persona]`                                                     | `generateStaticParams` → SSG, `revalidate: false` (tag-driven)  | `persona:{slug}, tracks:persona:{slug}, gallery:persona:{slug}`  |
| `/music`, `/music/[slug]`                                        | SSG                                                             | `tracks, track:{slug}`                                           |
| `/music/playlists/[slug]`                                        | SSG                                                             | `playlists, playlist:{slug}`                                     |
| `/events`                                                        | Static shell; Upcoming dynamic in Suspense (ISR 300s); Past SSG | `events:upcoming, events:past`                                   |
| `/events/[slug]`                                                 | SSG; ticket-availability slot ISR 600s                          | `event:{slug}`                                                   |
| `/gallery`, `/videos`                                            | SSG first page; further pages via server action                 | `gallery, videos`                                                |
| `/about /setup /services/* /press /rider /faq /programs /venues` | SSG                                                             | `page:{slug}, services, gear, experience`                        |
| `/blog*`                                                         | SSG + draft-mode dynamic bypass                                 | `posts, post:{slug}`                                             |
| `/contact`, `/book`                                              | Static shell + form islands; availability check `no-store`      | —                                                                |
| `/sitemap.xml`, feeds                                            | ISR 3600s                                                       | `sitemap`                                                        |
| admin (separate app)                                             | `force-dynamic`, `no-store`, `noindex`                          | —                                                                |

`revalidate: false` on persona pages is intentional: they are invalidated by
tag, not by clock. A time-based revalidate would either serve stale content or
waste rebuilds.

**PPR** is opted into per route (`export const experimental_ppr = true`) on
`/`, `/[persona]`, `/events` and `/events/[slug]`. Static shell = hero, nav,
layout. Dynamic holes = upcoming gigs, live play counts, ticket status,
availability badge.

---

## Debugging "I published but nothing changed"

In order:

1. Did the API emit `content.changed`? Check the structured log.
2. Did the webhook POST succeed? `RevalidationService` logs the response.
3. Did the signature verify? A 401 here is a `REVALIDATE_SECRET` mismatch
   between the API and web environments — the most common cause by far.
4. Was the right tag in the payload? Compare `TAG_MAP` against the tags the
   query module actually attached. An asymmetry between the two is the second
   most common cause.
5. Is the page in the CDN's 5-minute `s-maxage` window? `revalidateTag`
   invalidates the Data Cache, not a response already in an edge cache.
