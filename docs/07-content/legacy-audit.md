# Legacy site audit

The site this project replaces: `djfelicitous/`, a static Next.js 15 app.
**Deleted on 2026-09-10**, after its content was harvested into
`packages/db/seed/data/`.

This document exists for two reasons: so nobody re-introduces a bug that was
already paid for, and so the harvesting decisions can be audited later.

---

## What it was

Next.js 15.3.4, React 19, Tailwind v4, framer-motion. Six routes:
`/`, `/couple-duo`, `/bollywood`, `/psytrance`, `/techno`, `/discography`.
Roughly 3,000 lines of page components, 33 images, one video, no API routes, no
tests, no CI, not even a git repository.

## Every defect found

### Architecture

| Problem                                                                    | Consequence                                                                                 | Fixed by                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Every page `'use client'`**                                              | Zero SSR. No per-route `metadata` — a client component cannot export it.                    | Server-first architecture + `dj/no-client-in-route-files` lint rule                       |
| **All content hardcoded** in `src/data/djProfiles.ts` and `discography.ts` | The artist could not change a word without a developer. **The reason this project exists.** | Postgres + admin CMS                                                                      |
| Four near-duplicate 600-line persona pages                                 | Drifted apart: different section orders, inconsistent stats, hardcoded years                | One `[persona]` dynamic route ([ADR 0009](../01-decisions/0009-persona-dynamic-route.md)) |
| `reactStrictMode: false`                                                   | Masked real bugs                                                                            | Strict mode on                                                                            |

### SEO

| Problem                                                 | Consequence                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| No per-page metadata — one global block in `layout.tsx` | Every page shared one title and description                                     |
| No `sitemap.xml`, no `robots.txt`                       | Nothing guided crawlers                                                         |
| No JSON-LD at all                                       | No rich results for events, music or the business                               |
| No canonical URLs                                       | Duplicate-content risk                                                          |
| `logo.png` used as the 1200×630 OG image                | Wrong aspect ratio; broken social previews                                      |
| Footer linked to 8 non-existent routes                  | 404s on `/press`, `/contact`, `/about`, `/rider`, `/collaborate`, `/services/*` |

Net effect: for a business that lives on "wedding DJ Bangalore" searches, the
site was effectively invisible.

### The booking form

`BookingModal.tsx`, 281 lines. On submit:

```ts
console.log(formData);
alert('Booking request submitted!');
```

**Every enquiry ever submitted was silently discarded.** No email, no
persistence, no record. Budget brackets were in **USD** ("under-500",
"over-5000") for a business that quotes in rupees.

This is the single most expensive defect in the old site, and there is no way
to know how many bookings it cost.

### Styling

- **Three competing colour systems**: a `:root` block in `globals.css`, a stale
  v3-style `tailwind.config.ts`, and a separate "executive" Bootstrap-ish
  palette. Plus dead `globals-new.css` and `globals-backup.css` — 870 lines
  total.
- `site.webmanifest` `theme_color: #00ffff`, from an even older neon palette
  that no longer matched anything.
- **Orbitron referenced in class names but never loaded.** `font-orbitron`
  appeared on two pages and silently fell back to a system font.
- README documented a fourth palette that was not in use anywhere.

### Media

- All 20 `albumArt` paths pointed at `/images/tracks/`, **a directory that
  never existed.** Every one was broken; the page rendered a `♪` placeholder.
- Case mismatches: data said `/images/couple-1.JPG` and `/images/psy5.JPG`
  while disk had lowercase. Worked on Windows, **broken on any case-sensitive
  host.**
- 33 unoptimized JPG/PNG. No WebP, no AVIF, no `next/image` config.
- Missing referenced icons: `apple-touch-icon.png`, `favicon-16x16.png`,
  `favicon-32x32.png`, `android-chrome-*.png`.
- Four orphan images (`x1`, `x5`, `x6`, `x7.jpg`) referenced nowhere.

### Accessibility

- `viewport: { maximumScale: 1 }` — **pinch-zoom disabled**, a WCAG 1.4.4
  failure.
- No alt text on any of the 33 images.
- Neon-on-dark palette with no contrast verification.
- No skip links, no focus management.

### Data quality — the serious one

**Fabricated testimonials.** The psytrance and techno pages hardcoded
testimonials attributed to **Boom Festival, Ozora Festival, Rainbow Serpent,
Berghain, Fabric and Tresor** — venues the artist has not played, with invented
quotes.

Two separate problems: a false claim to prospective clients, and an explicit
Google structured-data violation if ever marked up as `Review`.

Also: `playlists` arrays with placeholder URLs
(`https://spotify.com/playlist/bollywood-bangers`) that rendered nowhere;
Spotify links stored as plain text names rather than URLs; inconsistent artist
strings (`DJ FELICITOUS`, `Felicitous`, `Trinitrocosmic/DJ Felicitous`);
inconsistent stats across pages (500+ events on one, 50K+ dancers on another);
`releaseDate` values all `YYYY-01-01` placeholders; hand-typed play counts; the
typo "Banglore".

### Security

**A live-looking Resend API key committed** in `djfelicitous/.env.local`
(UTF-16), alongside `BOOKING_EMAIL_TO=your-email@domain.com`. Nothing read
either — `resend` was not even a dependency.

> **This key must be rotated.** The directory is deleted, but the key may still
> be valid in the Resend account and may exist in any backup of that folder.
> [`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) gap #3.

### Dead code

`globals-backup.css`, `globals-new.css`, `HeroSection-backup.tsx`,
`placeholders-new.ts`, an empty `scripts/`, `performance.css` +
`performance.ts` (208 lines), and eight unreferenced components. Both
`lucide-react` and `react-icons` installed. `swiper` installed and unused.
Stale docs claiming "Live Demo: localhost:3001".

---

## The images are gone from disk

`djfelicitous/` was deleted before its 33 images were uploaded to Cloudinary.
They are catalogued above and in the seed data by filename, but **the files
themselves must come from the artist's originals** when Phase 5 builds
`seed/media.ts`. Seeded content is deliberately text-complete and image-free,
which is the correct state for testing the API and the fallback rendering.

See [`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) gap #4.

## What was harvested, and what was not

### Carried over

| Content                                              | Count | Into                        |
| ---------------------------------------------------- | ----- | --------------------------- |
| Persona identities, bios, subtitles, genres, socials | 4     | `seed/data/personas.ts`     |
| Tracks with real SoundCloud ids                      | 19    | `seed/data/tracks.ts`       |
| Venues parsed from gig strings                       | 7     | `seed/data/venues.ts`       |
| Branded nights parsed from gig strings               | 6     | `seed/data/venues.ts`       |
| Private-event testimonials                           | 8     | `seed/data/testimonials.ts` |
| Contact details                                      | —     | `seed/data/site.ts`         |
| Legacy routes as 301 redirects                       | 15    | `seed/data/redirects.ts`    |

### Deliberately dropped

| Dropped                                                                                         | Why                                                        |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **All festival and club testimonials** (Boom, Ozora, Rainbow Serpent, Berghain, Fabric, Tresor) | Fabricated. False claims plus a structured-data violation. |
| `playlists` arrays                                                                              | Placeholder URLs, rendered nowhere                         |
| All `albumArt` paths                                                                            | Pointed at a non-existent directory                        |
| `color` tokens (`neon-pink` etc.)                                                               | Resolved to nothing                                        |
| Hardcoded per-page stats                                                                        | Inconsistent; now `Stat` rows the artist controls          |
| `duration: 'N/A'`                                                                               | Now `null`; real values parsed to integer seconds          |
| The Resend key                                                                                  | To be rotated, not reused                                  |

### Transformed rather than copied

- **`gigs: string[]` → `Venue` + `Program`.** `'Housefull Sunday - BigPitcher
Sarjapur'` became a `Program` row and a `Venue` row, turning a display string
  into a linkable, crawlable graph.
- **No `Event` rows were seeded.** The legacy gig data carried **no dates,
  ticket links or lineups.** Inventing dates would repeat the fabricated-
  testimonial mistake in a different form. Real events go in through admin;
  `seed:demo` generates explicitly synthetic ones, prefixed `[DEMO]`, for local
  development.
- **Artist strings normalised** into a `PersonaKey` plus an `artistLabel`
  display credit.
- **BPM extracted** from titles that carried it inline
  (`'... | 180 BPM'` → `bpm: 180`).
- **Slugs renamed for SEO**: `/bollywood` → `/felicitous`, `/psytrance` →
  `/trinitrocosmic`, `/techno` → `/tnt`, `/couple-duo` →
  `/felicitous-x-geetz`. All 301 redirected.
- **Testimonials seeded `isVerified: false`**, so no `Review` markup is emitted
  until the artist confirms each one.
- **Typos fixed**: "Banglore" → "Bengaluru".

---

## The 301 map

| From                | To                          |
| ------------------- | --------------------------- |
| `/bollywood`        | `/felicitous`               |
| `/psytrance`        | `/trinitrocosmic`           |
| `/techno`           | `/tnt`                      |
| `/couple-duo`       | `/felicitous-x-geetz`       |
| `/discography`      | `/music`                    |
| `/services/private` | `/services/private-parties` |
| `/collaborate`      | `/contact`                  |

Plus documented no-op entries for the eight footer links that always 404d and
now resolve. Source: `packages/db/seed/data/redirects.ts`, mirrored in
`apps/web/next.config.ts`.
