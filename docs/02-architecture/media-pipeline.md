# Media pipeline

Cloudinary, with signed direct-from-browser uploads —
[ADR 0008](../01-decisions/0008-cloudinary-signed-direct-upload.md).
**Status: not yet built.** Phase 5 specification.

---

## Upload flow

```
admin browser                    API                        Cloudinary
     │  POST /media/upload-signature
     ├────────────────────────────►│
     │                             │ server picks the folder from
     │                             │ {purpose, personaSlug, entityType}
     │◄────────────────────────────┤ { signature, timestamp, apiKey,
     │                               cloudName, params }
     │  POST (multipart, params echoed verbatim)
     ├──────────────────────────────────────────────────────────►│
     │◄──────────────────────────────────────────────────────────┤
     │  POST /media  { cloudinary result }
     ├────────────────────────────►│
     │                             │ api.resource(publicId) ─────►│
     │                             │◄─── authoritative metadata ──┤
     │                             │ compute blurDataUrl, blurhash,
     │                             │ dominantColor, waveform peaks
     │◄────────────────────────────┤ MediaAsset row
```

Two properties carry the security of this design:

1. **The server decides the folder.** The client cannot write outside its
   taxonomy, even though it holds a valid signature.
2. **The server does not trust the upload result.** It re-reads bytes,
   dimensions, format and duration from the Cloudinary Admin API before
   inserting the row. This closes the "client lies about bytes or format" hole
   that most direct-upload implementations leave open.

The signed parameters also pin `allowed_formats`, `max_bytes` and
`resource_type`, so a signature for a 2MB image cannot be replayed to upload a
500MB video.

---

## Folder taxonomy

```
djf/{env}/personas/{slug}/{hero|gallery|avatar}
djf/{env}/events/{slug}
djf/{env}/programs/{slug}
djf/{env}/tracks/{artwork|audio}
djf/{env}/videos
djf/{env}/press-kit/{photos|logos|documents}
djf/{env}/gear
djf/{env}/brands
djf/{env}/_tmp            # unclaimed uploads, pruned after 24h
```

`{env}` keeps development uploads out of the production namespace.

---

## Named transformations

Bootstrapped once via the Admin API and referenced **by name**, so
transformation strings never scatter through JSX and can be retuned without a
redeploy.

| Name                  | Definition                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `t_djf_hero`          | `c_fill,g_auto:subject,w_1920,h_1080,q_auto:good,f_auto,dpr_auto` |
| `t_djf_card`          | `c_fill,g_auto:faces,w_800,h_1000,q_auto,f_auto`                  |
| `t_djf_gallery`       | `c_limit,w_1600,q_auto:good,f_auto`                               |
| `t_djf_thumb`         | `c_fill,g_auto,w_400,h_400,q_auto,f_auto`                         |
| `t_djf_blur`          | `c_fill,w_16,h_16,e_blur:400,q_30,f_webp`                         |
| `t_djf_og`            | `c_fill,w_1200,h_630,q_auto,f_jpg`                                |
| `t_djf_logo`          | `c_fit,w_400,h_200,q_auto,f_auto,e_grayscale`                     |
| `t_djf_flyer`         | `c_fit,w_1200,q_auto,f_auto`                                      |
| `t_djf_video_hero`    | `c_fill,w_1920,h_1080,q_auto,vc_auto,br_2m,f_auto,ac_none`        |
| `t_djf_video_preview` | `c_fill,w_640,h_360,so_0,du_6,e_loop,f_webm`                      |
| `t_djf_audio_stream`  | `f_mp3,ac_aac,br_128k`                                            |
| `t_djf_waveform`      | `fl_waveform,co_rgb:FF2D95,b_transparent,w_1200,h_180,f_png`      |

`ac_none` on the hero video strips the audio track: it is decorative, muted,
and shipping an audio stream nobody hears is wasted bytes.

**Eager transformations.** `t_djf_card|t_djf_og|t_djf_blur` are requested in the
signed upload params with `eager_async`, so the three derivatives most likely
to be needed at first paint exist before any page requests them.

---

## Placeholders

On create, the API fetches the `t_djf_blur` derivative (~400 bytes), base64s it
into `blurDataUrl`, computes `blurhash`, and captures `dominantColor` from
Cloudinary's `colors: true` response.

All three are stored on the row. So `placeholder="blur"` costs **nothing** at
runtime and needs no `plaiceholder` pass — and a skeleton can be painted in the
image's own dominant colour.

`focalX` / `focalY` are normalised 0–1 and drive `object-position`, so a
cropped hero portrait never decapitates the subject.

---

## Cropping is non-destructive

`react-easy-crop` in admin writes **Cloudinary transformation parameters**, not
new files. Presets 16:9, 4:5, 1:1, 21:9.

The original is never modified, so a crop is re-croppable forever. This matters
because the artist will change his mind, and because a destructive crop means
re-uploading a photo that may no longer exist anywhere else.

---

## Deletion is two-phase

`DELETE /api/v1/admin/media/:id`:

1. **Refuses with 409 if referenced**, listing the referencing entities:
   `{ code: 'MEDIA_IN_USE', errors: [{ entity: 'Event', id, title }] }`. The
   long list of reverse relations on `MediaAsset` exists for this counter.
2. With `?force=true` (requires `media:delete`, which `EDITOR` does not have),
   references are nulled in a transaction first.
3. Sets `deletedAt`. **The asset stays in Cloudinary**, recoverable from an
   admin trash view for 30 days.

### Nightly sweeper

1. Hard-delete assets soft-deleted more than 30 days ago, from both the
   database and Cloudinary. This is the **only** legitimate caller of
   `runWithHardDelete()`.
2. Prune `_tmp/` uploads never claimed by a `MediaAsset` row after 24h.
3. **Reconcile and report only.** Cloudinary assets under `djf/` with no
   database row are logged as `cloudinary_drift` and **never deleted**.

Step 3 is report-only deliberately. An auto-deleting reconciler is one bug away
from wiping the artist's entire photo library, and there is no undo.

---

## Audio and video

Cloudinary treats audio as `resource_type: video`.

- `durationSec` comes from the API response.
- **Waveform peaks are computed at upload** and stored in
  `MediaAsset.waveformPeaks`, so wavesurfer draws a waveform without
  downloading the audio file. This is what makes the mini player cheap.
- Progressive `f_mp3` with `Accept-Ranges` from the CDN is sufficient at this
  scale; no HLS for tracks.
- Long-form video (aftermovies, full sets) uses Cloudinary adaptive HLS, with
  `hls.js` loaded lazily and only when `canPlayType` reports no native support.

## Embeds are not media assets

SoundCloud, Spotify and YouTube live as `Track.embedUrl` and `StreamLink` rows.
Nothing is hosted by us.

`embedHtml` caches the oEmbed response, **sanitised on write** with
`sanitize-html` against a strict iframe allowlist — `w.soundcloud.com`,
`open.spotify.com`, `www.youtube-nocookie.com` — and refreshed on a 30-day TTL.
Sanitising on write rather than on render means every consumer is safe by
default.

---

## Alt text is required

Enforced in three places, because one is not enough:

1. The Zod contract requires it for `resourceType: IMAGE`.
2. The admin blocks attaching an asset to published content without it.
3. A database `CHECK` constraint rejects the row —
   `media_assets_image_alt_text`, exempting `OG_IMAGE` and `LOGO`, which are
   never rendered as page content.

The legacy site had no alt text on any of its 33 images.

---

## Phase 5 exit criteria

- A browser-signed upload lands in the correct **server-decided** folder,
  produces a `MediaAsset` with correct bytes, dimensions and `blurDataUrl`, and
  its `t_djf_card` / `t_djf_og` derivatives already exist.
- Deleting a referenced asset returns 409 listing the referencing entities.
- The sweeper removes a 31-day-old soft-deleted asset from both the database
  and Cloudinary, verified dry-run first.
- A background video and an audio track both round-trip, the audio with peaks.
