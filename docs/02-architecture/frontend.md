# Frontend — `apps/web` (Next.js 15, App Router)

**Status: not yet built.** Phase 7 onward. See
[`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md).

---

## Five principles

1. **Server-first.** A component is a Client Component only if it needs state,
   DOM refs, browser APIs or event handlers _that cannot be delegated to a
   leaf_. The legacy failure mode — `'use client'` at page level — is banned by
   the `dj/no-client-in-route-files` lint rule. Budget: **≤6 client islands and
   ≤90KB route-specific JS per route.**
2. **One token source of truth** — `packages/ui/src/styles/theme.css`. Raw
   colour literals in app code are a lint error.
3. **Motion is a layer, not a dependency.** Every heavy effect degrades to a
   static, server-rendered composition. Fallbacks are designed _first_.
   [ADR 0013](../01-decisions/0013-cinematic-video-with-motiongate-fallbacks.md).
4. **Budget-enforced.** `size-limit` and Lighthouse CI are merge gates.
5. **Content is data.** Every string, image, accent colour and section order
   comes from the API. Personas are rows, not routes.

---

## Route tree

Route groups: `(marketing)` for the public site, `(legal)` for a slim prose
layout. Personas are one dynamic route
([ADR 0009](../01-decisions/0009-persona-dynamic-route.md)).

```
app/
├─ layout.tsx  globals.css  manifest.ts  robots.ts  sitemap.ts
├─ icon.tsx  apple-icon.tsx  global-error.tsx
├─ (marketing)/
│  ├─ layout.tsx           # Header + MobileNav(client leaf) + Footer + MiniPlayer
│  ├─ template.tsx         # View Transition name scoping
│  ├─ error.tsx  loading.tsx  not-found.tsx
│  ├─ page.tsx  opengraph-image.tsx                      # HOME
│  ├─ [persona]/{layout,page,opengraph-image,loading,error}.tsx
│  │  └─ (sub)/{music,gallery}/page.tsx
│  ├─ music/
│  │  ├─ page.tsx  opengraph-image.tsx
│  │  ├─ [slug]/{page,opengraph-image}.tsx
│  │  ├─ albums/[slug]/page.tsx
│  │  └─ playlists/[slug]/page.tsx
│  ├─ events/
│  │  ├─ page.tsx  [slug]/{page,opengraph-image}.tsx
│  │  └─ archive/[[...year]]/page.tsx
│  ├─ programs/{page,[slug]/page}.tsx
│  ├─ venues/{page,[slug]/page}.tsx
│  ├─ gallery/
│  │  ├─ page.tsx
│  │  ├─ @modal/{default.tsx, (.)photo/[id]/page.tsx}    # intercepting lightbox
│  │  └─ photo/[id]/page.tsx                             # canonical, SEO
│  ├─ videos/{page.tsx, @modal/..., watch/[id]/page.tsx}
│  ├─ about/page.tsx        # story + experience timeline
│  ├─ setup/page.tsx        # console & gear showcase
│  ├─ services/{page,[slug]/page}.tsx
│  ├─ press/page.tsx  rider/page.tsx  testimonials/page.tsx
│  ├─ blog/{page,[slug]/page,tag/[tag]/page}.tsx
│  ├─ faq/page.tsx  contact/page.tsx  book/{page,thanks/page}.tsx
│  └─ (legal)/{privacy,terms,cookies}/page.tsx
└─ api/                    # BFF route handlers only
   ├─ revalidate/route.ts   draft/route.ts   draft/disable/route.ts
   ├─ press/download/route.ts   rider/pdf/route.ts
   ├─ feed.xml/route.ts   feed.json/route.ts   events.ics/route.ts
   └─ search-index/route.ts   health/route.ts
```

### The parallel + intercepting route pattern

`gallery/@modal/(.)photo/[id]` renders a lightbox over the grid on client
navigation. `gallery/photo/[id]` is the same content as a full SSR page for a
hard navigation or a shared link.

This gives three things at once: a fast in-place lightbox, a correct back
button, and a crawlable canonical page carrying `ImageObject` structured data.
The same pattern applies to `/videos`.

### Redirects

Legacy URLs 301 in `next.config.ts` — `/bollywood → /felicitous`,
`/psytrance → /trinitrocosmic`, `/techno → /tnt`,
`/couple-duo → /felicitous-x-geetz`, `/discography → /music` — mirrored from
`packages/db/seed/data/redirects.ts`. Static entries serve at the edge with no
database round trip; the `Redirect` table covers future slug changes without a
deploy.

---

## Data layer

`packages/api-client/src/server.ts` is `import 'server-only'`:

```ts
export async function apiGet<S extends z.ZodTypeAny>(
  path: string,
  { schema, tags = [], revalidate = false, cache, searchParams, draft }: Opts<S>,
): Promise<z.infer<S>> {
  const res = await fetch(url, {
    headers: { 'x-api-key': process.env.API_KEY!, accept: 'application/json' },
    cache: draft ? 'no-store' : cache,
    next: draft ? undefined : { tags, revalidate },
  });

  if (res.status === 404) throw new ApiError(404, path, 'not found');
  if (!res.ok) throw new ApiError(res.status, path, await res.text().catch(() => ''));

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    // Contract drift is loud on purpose. Rendering `undefined` silently is
    // how the legacy site shipped broken pages.
    console.error('contract drift', path, parsed.error.flatten());
    throw new ApiError(502, path, 'response failed contract validation');
  }
  return parsed.data;
}
```

Domain queries live in `apps/web/src/server/queries/*.ts`, own their cache tags,
and are wrapped in `React.cache()` — which halves API calls on any route where
`generateMetadata` and the page body need the same data.

**Server actions** for all public mutations (booking, newsletter, contact): no
client bundle on the submit path, progressive enhancement works, rate-limited
inside the action.

**TanStack Query in admin only.** It needs optimistic updates and cross-list
invalidation; server actions would fight its cache. `QueryProvider` never
enters the marketing bundle.

### Error boundaries

`global-error.tsx` (brand-styled last resort), `(marketing)/error.tsx` (retry +
navigation), and per-section `<ErrorBoundary>` around **optional** sections —
visualiser, gig map, live stats — so a single data hiccup never blanks a whole
page. `not-found.tsx` is a "no signal" CRT-static screen with search and top
links.

---

## Client components that are actually warranted

`MiniPlayer`, `WaveformPlayer`, `PersonaChannelSwitcher`, `MobileNav`,
`Lightbox`, `BookingWizard`, `FilterBar`, `GigMap`, `Visualizer`,
`SmoothScrollProvider`, Radix `Accordion`/`Tabs`, `CounterOnView`,
`CommandPalette`.

Everything else is a Server Component. If you are about to add `'use client'`,
check whether the interactive part can be a leaf instead.

### The mini player survives navigation

It lives in `(marketing)/layout.tsx`, **above** the route slot, so App Router
never unmounts it. That is the whole reason playback continues across
navigations. Do not move it into a page.

---

## Media

Cloudinary custom loader:
`f_auto,q_auto:good,w_{width},c_limit,dpr_auto,fl_progressive:steep`, with
`formats: ['image/avif','image/webp']` and `minimumCacheTTL: 31536000`.

A **`SIZES` constant module** (`heroFull`, `half`, `cardGrid3`, `cardGrid4`,
`masonry`, `thumb64`) — never ad-hoc `sizes` strings, which are the most common
source of over-fetched images.

Exactly **one `priority` image per route** (the LCP element), with
`fetchPriority="high"` and a server-emitted
`<link rel="preload" as="image" imagesrcset>`. Everything else is
`loading="lazy" decoding="async"`.

Hero video is ≤2.5MB, 8–10s, `muted playsInline loop preload="none"`, and
**decorative** — `aria-hidden`, with the poster as the LCP element so video
never delays the largest paint.

---

## Budgets (CI-enforced)

|                              | Limit                                       |
| ---------------------------- | ------------------------------------------- |
| First-load JS `/`            | ≤145KB gz                                   |
| First-load JS `/[persona]`   | ≤155KB gz                                   |
| First-load JS content routes | ≤120KB gz                                   |
| Shared framework chunk       | ≤92KB gz                                    |
| Any lazy island              | ≤100KB (3D exempt to ≤200KB, desktop-gated) |
| All fonts                    | ≤140KB                                      |
| All CSS                      | ≤28KB                                       |

LCP ≤2.0s p75 (4G, Moto G) · INP ≤150ms · CLS ≤0.02 · Lighthouse Perf ≥92
mobile / ≥98 desktop · A11y 100 · SEO 100.
