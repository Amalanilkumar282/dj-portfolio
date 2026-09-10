# SEO

This is where the legacy site lost the most. Every page was a Client Component,
so there was no server rendering, no per-route metadata, no sitemap, no
`robots.txt` and no structured data. For a business that lives on "wedding DJ
Bangalore" searches, it was effectively invisible.

**Status: not yet built.** Phase 7 specification.

---

## Metadata

`generateMetadata` on **all ~28 route patterns**, reading CMS `seo` fields with
computed fallbacks. Title template: `%s | DJ Felicitous — DJ in Bangalore`.

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>;
}): Promise<Metadata> {
  const { persona: slug } = await params;
  const p = await getPersona(slug); // React.cache'd — no extra fetch
  const url = absoluteUrl(`/${slug}`);

  return {
    title: p.seo.title ?? `${p.name} — ${p.genre} DJ`,
    description: p.seo.description ?? truncate(stripMarkdown(p.bio), 155),
    alternates: { canonical: url, languages: { 'en-IN': url, 'x-default': url } },
    openGraph: {
      type: 'profile',
      url,
      siteName: SITE.name,
      locale: 'en_IN',
      images: [
        { url: `${url}/opengraph-image`, width: 1200, height: 630, alt: `${p.name} — ${p.genre}` },
      ],
    },
    twitter: { card: 'summary_large_image', site: SITE.twitter },
    robots:
      p.status === 'published'
        ? {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          }
        : { index: false, follow: false },
  };
}
```

`React.cache()` on the query is what stops `generateMetadata` and the page body
making the same API call twice.

**`noindex`** on: unpublished content, `/book/thanks`, draft-mode pages, and
everything in the admin app.

---

## Dynamic OG images

`opengraph-image.tsx` per entity route via `next/og`: persona-accent gradient
mesh plus grain, large display type, the entity's Cloudinary image as a masked
panel, a "DJ FELICITOUS · BANGALORE" lockup, and for tracks a waveform rendered
from the stored peak array.

Shared layout in `packages/seo/og` keeps each generator to roughly 15 lines.
Fonts are subset to Latin uppercase plus digits (~18KB) to stay inside the edge
runtime limit.

**WhatsApp previews matter most in India** — check them there before Twitter.

---

## JSON-LD

One merged `@graph` per page. **One script tag, no duplicate entities**,
cross-referenced by stable `@id`. Typed with `schema-dts`.

```tsx
export function JsonLd({ graph }: { graph: readonly Thing[] }) {
  const payload: WithContext<Graph> = { '@context': 'https://schema.org', '@graph': graph };
  return (
    <script
      type="application/ld+json"
      // Escaping `<` prevents a script-tag break-out. No user HTML reaches here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload).replace(/</g, '\\u003c') }}
    />
  );
}
```

| Route                     | Graph                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Root layout (every page)  | `WebSite` (+ `SearchAction`, `inLanguage: en-IN`), `Organization`, `BreadcrumbList`                                             |
| `/`                       | `Person`, `MusicGroup`, `LocalBusiness`, `ItemList` of personas + upcoming events                                               |
| `/[persona]`              | `MusicGroup` (genre, `member`, `track`, `sameAs`, `foundingLocation`), `ImageObject`                                            |
| `/music/[slug]`           | `MusicRecording` (`byArtist`, ISO-8601 `duration`, `datePublished`, `audio`, `sameAs` streaming links)                          |
| `/music/albums/[slug]`    | `MusicAlbum` (`albumProductionType`, `numTracks`, `track`)                                                                      |
| `/music/playlists/[slug]` | `MusicPlaylist`                                                                                                                 |
| `/events/[slug]`          | `MusicEvent` (`eventStatus`, `eventAttendanceMode`, `location: Place` + `geo`, `performer`, `offers` with `priceCurrency: INR`) |
| `/services/*`             | `Service` + `OfferCatalog`, `areaServed: [Bengaluru, Karnataka, India]`; page-level `FAQPage`                                   |
| `/faq`                    | `FAQPage`                                                                                                                       |
| `/videos/watch/[id]`      | `VideoObject` (+ `hasPart: Clip[]` chapters, transcript)                                                                        |
| `/gallery/photo/[id]`     | `ImageObject` (+ `license`, `acquireLicensePage`)                                                                               |
| `/blog/[slug]`            | `BlogPosting`                                                                                                                   |
| `/about`                  | `AboutPage` + `Person` with `performerIn`                                                                                       |
| `/venues/[slug]`          | `Place`                                                                                                                         |

### Two rules that are not stylistic

**Event dates need an explicit IST offset.** `MusicEvent.startDate` must carry
`+05:30`. A bare `Z` makes Google display Indian gigs at the wrong local time
in rich results. Use `isoWithIstOffset()` from `@dj/utils`.

**`Review` and `AggregateRating` are emitted only for `isVerified`
testimonials.** All eight seeded testimonials are `isVerified: false`.
Fabricated review markup is an explicit Google structured-data violation, and
the legacy site had exactly that. See
[`../07-content/brand.md`](../07-content/brand.md).

---

## Sitemaps

Split via `generateSitemaps()` behind an index: `static`, `personas`, `music`,
`events`, `programs`, `venues`, `gallery`, `videos`, `blog`, `services`.

```ts
export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 'events': {
      const events = await getAllEventsForSitemap();
      return events.map((e) => ({
        url: absoluteUrl(`/events/${e.slug}`),
        lastModified: e.updatedAt, // real, from the DB
        changeFrequency: e.startsAt > new Date() ? 'daily' : 'yearly',
        priority: e.startsAt > new Date() ? 0.9 : 0.4,
        images: e.poster ? [cloudinaryUrl(e.poster.publicId, 1200)] : undefined,
      }));
    }
  }
}
export const revalidate = 3600;
```

`lastModified` comes from the entity's `updatedAt`, **not** build time — which
is why the `*_published_has_date` CHECK constraints exist. `revalidateTag('sitemap')`
fires on every publish, so Google sees a fresh `lastmod` within minutes.

Also: `/api/feed.xml` (RSS), `/api/feed.json`, and **`/api/events.ics`** — a
subscribable gig calendar that promoters and venues actually use, and that
earns backlinks.

---

## robots.ts

```ts
const prod = process.env.VERCEL_ENV === 'production';
return {
  rules: prod
    ? [
        {
          userAgent: '*',
          allow: '/',
          disallow: ['/api/', '/draft', '/book/thanks', '/*?*sort=', '/*?*page='],
        },
        { userAgent: 'GPTBot', allow: '/' },
      ] // AI answers should cite the artist
    : [{ userAgent: '*', disallow: '/' }], // never index a preview deploy
  sitemap: `${SITE.url}/sitemap.xml`,
};
```

Faceted `?sort=` and `?page=` are disallowed to avoid crawl-budget waste on
duplicate content.

---

## Local SEO — Bengaluru and India

One canonical `LocalBusiness` / `EntertainmentBusiness` node with a stable
`@id`: `areaServed` covering Bengaluru, Karnataka, India and destination
weddings; Bengaluru `geo`; `priceRange`; E.164 `telephone`; `hasMap` to the
Google Business Profile. NAP consistency in the footer, matching that profile.

**Location and venue landing pages** (Phase 13) — CMS-driven and **never
doorway spam**. Each must have unique venue lists, real galleries and real
testimonials, or it does not ship: `/services/weddings/bangalore`,
`/services/weddings/goa`, `/services/corporate/bangalore`, `/venues/[slug]`.

Query clusters, each mapped to exactly **one** canonical page to prevent
cannibalisation: _wedding DJ Bangalore_, _sangeet DJ Bangalore_, _Bollywood DJ
for wedding_, _psytrance DJ India_, _techno DJ Bangalore_, _corporate event DJ
Bengaluru_, _DJ couple duo India_, _book DJ Bangalore price_.

---

## i18n readiness without the dependency

Ship the structure, defer the translations. All copy already comes from the API,
so a `locale` column is additive. `hreflang` comes from one helper. Routes are
slug-driven. The middleware has a commented locale-negotiation branch.

**No `next-intl` and no second locale until Hindi or Kannada is actually
commissioned.**

---

## Analytics

Plausible (cookieless) as primary, plus Vercel Speed Insights for real-user
Core Web Vitals. GA4 loads **only after consent**, through the
`@dj/analytics` consent-gated bus. The consent cookie is read **server-side**,
so no tag ships to a non-consenting visitor.

Events: `persona_channel_switch`, `track_play`, `track_complete_50`,
`booking_started`, `booking_step_{n}`, `booking_submitted`, `whatsapp_click`,
`phone_click`, `press_kit_download`, `rider_download`, `event_ical_add`,
`gallery_lightbox_open`, `video_play`, `outbound_platform_click`.

---

## Phase 7 exit criteria

- Every public route prerendered; **every internal link resolves 200**
  (Playwright link crawl — this closes the legacy dead-footer-link class of bug
  permanently).
- `generateMetadata` on all route patterns.
- Google Rich Results Test: **zero errors** across persona, event, track,
  service, FAQ and article pages.
- Every legacy URL 301s, verified in e2e.
- Lighthouse SEO 100.
