# Content model guide

Written for whoever is filling the CMS — the artist, or a developer seeding
content. Plain-language descriptions of what each content type is for and how
the pieces relate.

For the technical schema, see
[`../02-architecture/data-model.md`](../02-architecture/data-model.md).

---

## Start here: how it fits together

```
Persona  (DJ Felicitous / Trinitrocosmic / TNT / Felicitous & Geetz)
  ├─ Tracks ──── grouped into ─► Playlists    and/or ─► Releases
  ├─ Events ──── held at ──────► Venues       and part of ─► Programs
  ├─ Galleries ─ containing ───► Media
  ├─ Testimonials, Stats, Services, Videos, Brands, FAQs
  └─ SEO metadata
```

**Almost everything hangs off a persona.** When adding content, decide which
identity it belongs to first. Content with no persona is treated as site-wide.

---

## The content types

### Persona

The four performing identities. You will rarely create one; you will often edit
one.

The fields that change the site most: **bio** (markdown, shown on the persona
page), **accent colour** (re-themes the entire page — try it), **sections**
(the order the page tells its story in), and **hero media**.

### Track

One recording: an original, a remix, a live set, a mix or a collaboration.

A track can live on SoundCloud (paste the track id) or be uploaded as audio.
Both work. **BPM and musical key are worth filling in** — they appear in mono
type as credibility signals to other DJs and promoters.

Play and like counts are **hand-entered**, not live. Keep them roughly honest;
they are not synced from any platform yet.

### Playlist

A curated, ordered set of tracks — the "listen to my work" showcase. Drag to
reorder.

This is the strongest asset on the site for a promoter who wants to hear what
you actually do. Four exist: Originals & Remixes, Dancefloor Sets, Technoverse,
Cosmic Journeys.

### Release

An album, EP, single or compilation. Tracks belong to it and it has its own
cover and streaming links. Use it when something was released as a body of
work; otherwise a Playlist is the better fit.

### Event

A specific performance on a specific date. **Date, venue and persona are the
important fields.**

Events automatically move from Upcoming to Past. Add a flyer before, and a
gallery after — post-event photos are what make the archive worth crawling.

**Never add an event with a guessed date.** Leave it out until the date is
confirmed.

### Venue

A place you have played. Create it once; every event there links to it.

Venues get their own pages and appear on the gig map, so **latitude and
longitude matter** — they are seeded approximately and should be corrected.

### Program

A recurring or branded night: "Housefull Sunday", "Bolly-Tech", "Clubbers
Friday". Groups many events at a venue. Use it for a residency; use a plain
Event for a one-off.

### Gallery and Media

Photos grouped into galleries, attached to a persona, event or program.

**Alt text is required** — you cannot publish an image without it. Describe
what is in the photo in a short sentence: _"DJ Felicitous behind a CDJ setup
with a packed dancefloor behind him."_ It serves blind visitors and it helps
image search.

Set the **focal point** on any portrait, or wide crops will cut off heads.

### Video

Reels, aftermovies and full sets. YouTube, Vimeo or uploaded.

Adding a **transcript** is worth the effort: it helps deaf viewers and it is
crawlable text that a video alone is not.

### Testimonial

A real quote from a real client.

**Mark it verified only when you are sure it is genuine and you are happy for
it to be published as a review.** Verified testimonials are marked up for
Google rich results; unverified ones display but are not marked up. See
[`brand.md`](brand.md).

### Service

A package: weddings, corporate, clubs, private, festivals, production.

**These are the pages that produce bookings.** Fill in inclusions and
exclusions honestly — the clarity is what wins a planner over.

Prices can be left empty; that renders "On request", which is a legitimate
answer for bespoke work and better than a number you would not honour.

### Gear

Your equipment. Doubles as the **technical rider** — tick "rider item" and it
appears on `/rider` for venues, so equipment is maintained in exactly one
place.

### Experience

The career timeline on `/about`: residencies, roles, labels, teaching.

### FAQ

Questions clients actually ask. **Plain text answers only** — no formatting.
These get marked up for Google, which can surface them directly in search
results, so they are unusually high-value.

### Stat

The counters: events played, years active, cities. **Use your real numbers.**

### Brand

Venues and brands you have worked with, for the logo strip. A mono logo variant
looks better in a row.

### Press asset

Downloadable press-kit material: hi-res photos, logo pack, bio PDF, tech rider,
stage plot. Mark an item "requires email" to gate it behind an address capture.

### Post

A blog article. **Blog is switched off until there is content** — an empty
`/blog` in the sitemap is worse than no blog.

When it is on, this is the SEO engine: "Top sangeet songs 2026", "How to plan
your wedding music timeline", "A guide to the Bengaluru club scene".

### Booking inquiry

Not something you create — this is where form submissions land.

The pipeline: **New → Contacted → Quoted → Negotiating → Booked**, or Lost, or
Spam. Move cards as you work them; the funnel view depends on it being kept
current.

### Site settings

Contact details, WhatsApp number, default SEO, feature flags. One record.

**Keep the address and phone number identical to the Google Business Profile.**
Search engines cross-check them, and a mismatch weakens local ranking.

---

## Draft, schedule, publish

Every content type has the same three states:

- **Draft** — invisible to the public. Preview it with "Open live preview".
- **Scheduled** — goes live automatically at the time you set (IST).
- **Published** — live.
- **Archived** — removed from the site, kept in the CMS.

Publishing updates the live site within seconds. The panel shows "Live in ~5s"
so you can tell it worked.

**Deleting never destroys anything.** Deleted content sits in Trash for 30 days
and can be restored.

## SEO panel

Every content type has one. Both fields are optional — sensible values are
generated from the content if you leave them blank.

- **Title** — aim for under 60 characters, or Google truncates it.
- **Description** — under 160. This is the sentence that appears in search
  results, so write it as a reason to click.

The panel previews both as they will appear.

## Practical tips

1. **Fill in alt text as you upload**, not later. Later never comes, and you
   cannot publish without it.
2. **Persona first.** Content on the wrong persona shows on the wrong page.
3. **Accent colour is worth playing with** — it re-themes an entire persona
   page, and the change is live in seconds.
4. **Add event galleries afterwards.** Past events with photos are what make
   the archive worth reading.
5. **Never guess a date or a price.** Leave it empty.
6. **Reorder by dragging** — playlists, gallery images, FAQs, persona sections.
   Keyboard alternatives exist in each item's menu.
