# 0008 — Signed direct browser uploads to Cloudinary

**Status:** Accepted · **Date:** 2026-09-10

## Context

The artist uploads photos, hero videos and audio from Bengaluru, sometimes from
a phone. Files routed through the API would cross the network twice and hit
body-size limits.

## Decision

The browser uploads straight to Cloudinary using a signature minted by the API.
`POST /api/v1/media/upload-signature` returns the signature and the exact
parameters to echo back.

Two properties matter:

1. **The server decides the folder**, derived from `{purpose, personaSlug,
entityType}`. The client cannot write outside its taxonomy.
2. **The server does not trust the upload result.** After the browser reports
   success, the API calls `cloudinary.api.resource(publicId)` and re-reads
   authoritative bytes, dimensions, format and duration before writing the
   `MediaAsset` row.

## Consequences

- Uploads are fast and never touch our compute; no 4.5MB serverless body limit.
- Point 2 closes the "client lies about bytes or format" hole that most
  direct-upload implementations leave open.
- Eager transformations (`t_djf_card`, `t_djf_og`, `t_djf_blur`) are requested
  in the signed parameters, so the derivatives most needed at first paint exist
  before any page requests them.
- `blurDataUrl`, `blurhash` and `dominantColor` are computed once at upload and
  stored on the row, so `placeholder="blur"` costs nothing at runtime.
- Deletion is two-phase: refuse if referenced (409 listing the referencing
  entities), then soft-delete, then purge from Cloudinary 30 days later.
- The nightly reconciler **reports** Cloudinary-without-DB-row drift and never
  deletes. An auto-deleting reconciler is one bug away from wiping the
  artist's photo library.
- Cost: two round trips per upload (sign, then confirm) and an
  `CLOUDINARY_API_SECRET` that must never reach either frontend.

## Alternatives rejected

- **Proxy uploads through the API.** Doubles transfer, hits body limits, and
  makes large video uploads fragile.
- **Unsigned upload presets.** Anyone with the cloud name could write into the
  account.
- **S3 + self-managed transforms.** Cloudinary's `f_auto`/`q_auto`, named
  transformations and video pipeline are most of the value here.
