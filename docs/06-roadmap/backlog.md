# Backlog

Ideas not committed to a phase. Nothing here is a decision — moving an item
into a phase requires deciding it, and anything architectural requires an ADR.

## Considered and deliberately deferred

| Item                  | Trigger to reconsider                                              |
| --------------------- | ------------------------------------------------------------------ |
| Upstash Redis         | A second API replica, or BullMQ                                    |
| BullMQ                | A job exceeding ~10s, or a newsletter over ~500 recipients         |
| Meilisearch           | More than ~200 tracks, where trigram + tsvector stops being enough |
| Prometheus + Grafana  | Somewhere to actually send the metrics                             |
| Staging environment   | A change that genuinely cannot be validated on a preview deploy    |
| i18n (Hindi, Kannada) | Translations actually commissioned. The structure is ready.        |
| Prisma Accelerate     | Moving the API to a serverless host                                |

## Growth ideas (Phase 13 candidates)

- Location landing pages — `/services/weddings/bangalore`, `/goa`. **Only with
  unique venue lists, real galleries and real testimonials.** Otherwise it is
  doorway spam and actively harmful.
- Venue pages from the existing `Venue` graph.
- Post-event testimonial collection: automated email plus a review form. The
  honest way to grow verified social proof.
- Spotify and SoundCloud API sync for real play counts, replacing the
  hand-entered figures.
- `/search` backed by the existing search index.
- PWA offline shell for the press kit and rider — genuinely useful to a
  promoter in a venue with bad signal.
- A/B testing the booking CTA via Vercel Edge Config.
- Availability calendar exposed publicly, so planners can self-filter by date.

## Non-goals — do not build without a new decision

Ticketing or payments · fan accounts · merch · multi-tenancy · live streaming ·
real-time play counts at launch. See
[`../00-overview.md`](../00-overview.md).

## Known technical debt

| Item                                   | Notes                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| No Postgres on the dev machine         | STATUS gap #1. Blocks the Docker Compose verification.                                                                               |
| Legacy images not in Cloudinary        | 33 catalogued, not uploaded. `seed/media.ts` is a Phase 5 task.                                                                      |
| Legacy Resend key not rotated          | STATUS gap #3. Security follow-up.                                                                                                   |
| Venue coordinates approximate          | Seeded as area centroids; correct in admin.                                                                                          |
| `packages/db` has both `pg` and Prisma | `pg` is devDependency-only, for the post-migrate DDL batch. [ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md). |
