# Overview

## The problem

DJ Felicitous had a static Next.js portfolio. Every piece of content — bios,
track lists, gig history, testimonials — lived in two TypeScript files
(`src/data/djProfiles.ts` and `src/data/discography.ts`). Changing a single
word required a developer, a code edit and a deploy.

That was the headline problem. Auditing the site found several more, and the
combination is why it is being replaced rather than refactored:

- Every page was a Client Component, so there was **no server rendering**, no
  per-route metadata, no sitemap, no `robots.txt` and no structured data. For a
  business that lives on being found by people searching "wedding DJ
  Bangalore", the site was effectively invisible.
- The booking form called `console.log` and `alert('Booking request
submitted!')`. **Every enquiry ever submitted was discarded.** Its budget
  brackets were in USD for a business that quotes in rupees.
- Eight footer links pointed at routes that did not exist and returned 404,
  including `/press` and `/contact`.
- Three competing colour systems across three CSS files; a font referenced in
  class names but never loaded; 20 track artwork paths pointing at a directory
  that never existed; image filenames whose casing broke on case-sensitive
  hosts.
- Testimonials attributed to Boom Festival, Ozora, Berghain, Fabric and Tresor
  — venues the artist has not played, with invented quotes.

The full audit is in [`07-content/legacy-audit.md`](07-content/legacy-audit.md).

## What we are building

A CMS-backed portfolio and booking platform, in three apps:

- **`apps/web`** — the public site. Server-rendered, cinematic, built to
  convert event organisers and wedding planners into booked dates, and to rank
  for Bengaluru and India DJ-booking searches.
- **`apps/admin`** — the CMS. A separate app on its own subdomain so no admin
  JavaScript and no session cookie ever reach the public origin.
- **`apps/api`** — NestJS. Owns the database, the business rules and the
  security boundary.

## Who it is for

| Audience                        | What they need from the site                                                    | What that implies                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **The artist**                  | To change anything himself, from his phone, without asking a developer          | Admin panel is a first-class product, not an afterthought. Drag-to-reorder, live preview, media library. |
| **Wedding and event planners**  | To decide quickly whether he fits their event and budget, then get a reply fast | Services pages with real inclusions, fast contact paths, WhatsApp, a response-time promise               |
| **Club and festival promoters** | Music to listen to, a press kit, a technical rider, past venues                 | Playlists, `/press`, `/rider`, venue graph                                                               |
| **Search engines**              | Crawlable, structured, fast pages                                               | Server-first rendering, full JSON-LD graph, per-entity sitemaps                                          |
| **Fans**                        | Music and upcoming dates                                                        | Persistent audio player, events with add-to-calendar                                                     |

## The four personas

One artist, four performing identities. This is the central modelling fact of
the project: personas are **rows in a table**, not routes in the code.

| Key              | Slug                 | Name                     | Sound                               |
| ---------------- | -------------------- | ------------------------ | ----------------------------------- |
| `COUPLE_DUO`     | `felicitous-x-geetz` | DJ Felicitous & DJ Geetz | Multi-genre couple duo              |
| `FELICITOUS`     | `felicitous`         | DJ Felicitous            | Bollywood, South Indian, commercial |
| `TRINITROCOSMIC` | `trinitrocosmic`     | Trinitrocosmic           | Psytrance                           |
| `TNT`            | `tnt`                | TNT                      | Melodic and industrial techno       |

The legacy site had four near-duplicate 600-line page components that had
drifted apart. Here there is one `app/(marketing)/[persona]/page.tsx` with
`generateStaticParams`, and each persona's accent colour, section order and
copy come from the database. A fifth identity ships with zero code.

## Goals

1. **The artist is self-sufficient.** The Phase 11 exit criterion is a recorded
   session in which he publishes a track, an event, a playlist and a gallery
   with no developer involved.
2. **Every enquiry is captured.** Persisted, acknowledged by email, surfaced in
   an admin pipeline, and never silently dropped.
3. **Rank for the searches that produce bookings.** Bengaluru and India
   wedding, corporate, club and festival DJ queries.
4. **Look like the best DJ site the visitor has seen**, while staying fast and
   accessible. Cinematic full-bleed video and WebGL, with a beautiful
   server-rendered fallback underneath everything.
5. **Be safe to hand to another developer or agent.** Hence this
   documentation, the ADRs and the phase tracker.

## Non-goals

Deliberately out of scope. Do not build these without a new decision.

- **Ticketing or payments.** Events link out to whoever sells the tickets.
- **A fan account system.** No public login. Auth exists for admin only.
- **Merch or a shop.** There is a `featureShopEnabled` flag and nothing behind it.
- **Multi-tenancy.** This is one artist's site, not a platform for DJs.
- **Live streaming.**
- **Real-time play counts at launch.** Counts are hand-curated and must not be
  presented as live. Platform API sync is Phase 13.
- **Translations at launch.** The structure is i18n-ready — all copy comes from
  the API, `hreflang` comes from one helper — but no `next-intl` and no second
  locale until Hindi or Kannada is actually commissioned.

## Glossary

| Term                 | Meaning                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Persona**          | One of the four performing identities. A `Persona` row.                                                                        |
| **Program**          | A recurring or branded club night, e.g. "Housefull Sunday". Groups many events.                                                |
| **Playlist**         | A curated, orderable set of the artist's own tracks — the "listen to my work" showcase.                                        |
| **Release**          | An album, EP, single or compilation containing tracks.                                                                         |
| **Inquiry**          | A booking enquiry. Has a status pipeline: `NEW → CONTACTED → QUOTED → NEGOTIATING → BOOKED`, or `LOST` / `SPAM`.               |
| **Rider**            | The technical rider: equipment and hospitality requirements sent to venues. Generated from `GearItem` rows.                    |
| **Publish workflow** | `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`) + `publishedAt` + `scheduledAt` on every content model.                              |
| **Soft delete**      | `deletedAt` timestamp. Content is never physically deleted by the app.                                                         |
| **Cache tag**        | A string like `persona:tnt` that ties Next.js cached data to an entity, so the API can invalidate exactly what changed.        |
| **MotionGate**       | The component every heavy visual effect passes through, choosing between the full effect and a static fallback.                |
| **Post-migrate SQL** | `packages/db/prisma/sql/post-migrate.sql` — DDL Prisma cannot express (partial indexes, CHECK constraints, generated columns). |
| **IST**              | Asia/Kolkata, UTC+05:30, no daylight saving. All timestamps stored UTC, displayed IST.                                         |
