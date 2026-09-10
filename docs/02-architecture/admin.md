# Admin panel — `apps/admin`

A separate Next.js app on `admin.djfelicitous.com`
([ADR 0002](../01-decisions/0002-separate-admin-app.md)).
**Status: not yet built.** Phase 11 specification.

> **This is the product.** The whole project exists so the artist can change
> content himself. An admin panel that is technically complete but annoying to
> use has failed, because he will stop using it and ask a developer instead.
>
> **Phase 11 exit criterion:** a recorded session in which he publishes a
> track, an event, a playlist and a gallery set end to end, with no developer
> involved.

---

## Layout

Collapsible left sidebar grouped **Content / Media / Bookings / Site /
System**. Top bar with `⌘K` search, an environment badge, "View site" and
"Preview draft", and the user menu.

Edit screens are **two-column**: the form on the left, a sticky right rail
with:

- Status (draft / scheduled / published / archived)
- Publish and schedule controls
- SEO panel — live SERP and OG previews with character counters
- Slug editor with a collision check
- Revision history
- "Open live preview"

---

## Lists

TanStack Table with server-side pagination, sorting and filtering. Saved views,
bulk actions, inline quick-edit for title / status / order, `j`/`k`/Enter row
navigation, and a `@drawer` parallel route for quick-edit **without losing list
state** — losing your filters because you opened one row is the single most
irritating thing a CMS can do.

---

## Rich text

Tiptap v3, storing **ProseMirror JSON, never HTML**
([ADR 0010](../01-decisions/0010-tiptap-json-storage.md)).

Custom nodes for what the site actually needs: `TrackEmbed`, `PlaylistEmbed`,
`EventEmbed`, `GalleryEmbed`, `Callout`, `Figure` (which **enforces alt text
and caption**), plus SoundCloud and YouTube oEmbed. A `/` slash-command menu
and a bubble toolbar.

---

## Media library

Grid and list views, folder / tag / persona filters, search, infinite scroll,
and a picker mode for attaching to content.

Uploads go **direct browser → Cloudinary** with a server-minted signature —
`react-dropzone` with folder support, per-file progress, concurrency 3,
resumable chunked upload for large video, and paste-from-clipboard.

**Alt text is a gate**, not a suggestion: an image cannot be attached to
published content without it.

Cropping via `react-easy-crop` writes Cloudinary transformation parameters, not
new files, so every crop is reversible. A click-to-set focal-point picker
writes `focalX` / `focalY`.

Full detail in [`media-pipeline.md`](media-pipeline.md).

---

## Reordering

`@dnd-kit` for persona sections, gallery order, tracklists, playlists, FAQ
order and nav items.

Two requirements, both non-negotiable:

- **Keyboard support** via `@dnd-kit`'s `KeyboardSensor` with live-region
  announcements.
- **Explicit "Move up" / "Move down" menu items**, because WCAG 2.2 SC 2.5.7
  requires a non-dragging alternative for any dragging action.

Persisted as one optimistic `PATCH /reorder` using **fractional indexing**, so
moving one item rewrites one row rather than renumbering the whole list.
`PlaylistTrack.sortIndex` is a `Float` for exactly this reason.

---

## Draft, publish, schedule

A segmented status control, an **IST** date-time picker with relative text
("publishes in 3 days"), and a diff against the live version.

### Live preview via Next.js Draft Mode

1. `POST /api/draft` on `apps/web` with a validated preview token sets the
   draft cookie and redirects to the entity's public URL.
2. The admin edit screen embeds that URL in a **resizable iframe** with
   desktop / tablet / mobile presets, and posts form state to it on debounce.
3. The draft route is `no-store`, so **drafts never poison the CDN**.
4. An unmistakable "DRAFT — exit preview" bar renders on any draft-mode page.

---

## Forms

`react-hook-form` + the **same Zod contract the API uses**
([ADR 0004](../01-decisions/0004-zod-contracts-over-openapi-codegen.md)), so
client and server validate identically. `mode: 'onBlur'`.

- **Unsaved-changes guard** — `beforeunload` plus an App Router navigation
  intercept.
- **Autosave to draft every 20 seconds**, with a "Saved 12:04" indicator.
- **Optimistic-concurrency conflict detection** via `updatedAt`: a 409 opens a
  "Someone else edited this" merge dialog rather than silently overwriting.

API validation errors carry a JSON Pointer in `errors[].pointer`, so they map
to form fields mechanically instead of by string-matching messages.

---

## Optimistic updates

TanStack Query `onMutate` patches the cache immediately for status toggles,
reorder, delete and feature; rolls back on error with a `sonner` toast offering
"Retry"; invalidates on settle.

Publish actions additionally surface the revalidation result — "Live in ~5s" —
because that round trip is user-visible trust. If the artist cannot tell
whether his change went live, he will publish again, and again.

---

## Dashboard and extras

- **Booking Kanban** — `NEW → CONTACTED → QUOTED → NEGOTIATING → BOOKED`, plus
  `LOST` and `SPAM`, drag-and-drop via `@dnd-kit`.
- **Availability calendar** showing held and confirmed dates with conflict
  warnings.
- **Audit log** — filterable table with a before/after JSON diff viewer, IST
  timestamps, linked from each entity's revision history.
- `⌘K` command palette, `⌘S` save, `⌘⏎` publish, `g e` go to events.
- Dark theme matching the brand.

---

## RBAC in the UI

Gating is **server-side**: the sidebar and route segments render from the
session's permission set, and route-level `layout.tsx` guards redirect
unauthorised users. A `<Can action="publish" on="track">` component handles
in-page affordances.

**This is UX, not security.** The API is the enforcement point. Never rely on a
hidden button. See [`auth-and-rbac.md`](auth-and-rbac.md).

Bundle budget: ≤320KB first-load — generous relative to the public site
precisely because none of it reaches the public site.
