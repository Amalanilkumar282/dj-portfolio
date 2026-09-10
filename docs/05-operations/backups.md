# Backups

> An untested backup is not a backup. A restore drill is a **Phase 12 exit
> criterion**, and quarterly thereafter.

## What is backed up

| Asset                | Mechanism                                                                                                             | RPO | RTO                               | Verified by                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------- | ------------------------------------------------- |
| Postgres             | Neon PITR (7d Launch / 30d Scale)                                                                                     | ~1s | minutes — branch from a timestamp | Quarterly restore drill into a scratch branch     |
| Postgres, off-site   | Nightly GitHub Action: `pg_dump -Fc` → Cloudflare R2, age-encrypted, 30 daily + 12 monthly                            | 24h | ~15 min                           | Monthly automated `pg_restore --list` smoke check |
| Cloudinary media     | Cloudinary is the system of record; nightly manifest (publicId, version, bytes, checksum) committed to a private repo | 24h | manual                            | Manifest diff alert                               |
| Cloudinary, off-site | **Weekly `rclone` sync of `djf/` to R2**                                                                              | 7d  | hours                             | Size and count assertion                          |
| Secrets              | 1Password vault + a sealed offline copy                                                                               | —   | —                                 | Quarterly review                                  |
| Code                 | GitHub, plus a mirror push to a second remote                                                                         | —   | —                                 | —                                                 |

## Why two layers for Postgres

Neon PITR is excellent and is the primary. The off-site `pg_dump` exists for
the scenario PITR cannot cover: losing access to the Neon account itself, or
Neon losing the project. Different failure domain, so it needs a different
provider.

## Why the Cloudinary off-site copy matters

This one is easy to skip and expensive to have skipped.

Cloudinary holds the **only** copies of the artist's photography — the legacy
`public/images` directory is gone, and the originals may not exist anywhere
else. A compromised admin session plus the `?force=true` delete path could
remove them, and Cloudinary's own recycle bin is time-limited.

The nightly **manifest** is cheap and detects unexpected deletion. The weekly
**sync** is what actually lets you recover from it.

Note the media deletion design is already defensive: two-phase delete with a
30-day soft-delete window, and a reconciler that **reports** drift rather than
deleting.
[ADR 0008](../01-decisions/0008-cloudinary-signed-direct-upload.md).

## Restoring

See [`runbooks/restore.md`](runbooks/restore.md).

Short version for Postgres: branch from a timestamp in the Neon console,
**verify on the branch**, then repoint `DATABASE_URL` / `DIRECT_URL`. Never
restore over the primary before verifying.

## The drill

Quarterly, and dated in this file:

1. Create a Neon branch from a timestamp 24 hours ago.
2. Point a local checkout at it.
3. Confirm: personas present, tracks present, recent enquiries present, row
   counts within expectation of production.
4. Run `pnpm --filter @dj/db test` against it — this verifies the partial
   indexes and CHECK constraints survived, which a schema-only restore can
   silently lose.
5. Delete the branch. Record the date and the RTO observed.

| Date | Result                       | RTO |
| ---- | ---------------------------- | --- |
| —    | Not yet performed. Phase 12. | —   |

## What is deliberately not backed up

- **Generated Prisma client** — regenerated from the schema.
- **Next.js build output and caches** — rebuilt.
- **The Next.js Data Cache** — rebuilt on demand from the API.
- **Access tokens** — stateless and short-lived by design.
- **`node_modules`** — the lockfile is the backup.
