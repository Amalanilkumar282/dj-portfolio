# Runbook — restore

> **Never restore over the primary before verifying on a branch.** Neon makes
> branching cheap specifically so you do not have to gamble.

## Postgres — point in time (primary method)

1. **Establish the target timestamp.** Find when the bad change happened, from
   `audit_logs`, Sentry, or the deploy log. Pick a moment shortly _before_ it.
2. **Branch from that timestamp** in the Neon console: Branches → Create →
   from a point in time. Name it `restore-YYYYMMDD-HHMM`.
3. **Verify on the branch** — point a local checkout at its URLs:

   ```bash
   DATABASE_URL=<branch pooled> DIRECT_URL=<branch unpooled> pnpm db:studio
   ```

   Confirm: the four personas are present and published; tracks and playlists
   are intact; recent enquiries exist; the specific lost data is actually
   there. If it is not, branch from an earlier timestamp — do not proceed.

4. **Verify the schema objects survived:**

   ```bash
   DATABASE_URL=<branch> DIRECT_URL=<branch> pnpm --filter @dj/db test
   ```

   This asserts the partial indexes and CHECK constraints still exist. A
   restore that loses them leaves the database quietly slow and permissive.

5. **Decide the scope.**
   - _Whole-database rollback:_ repoint Railway `DATABASE_URL` / `DIRECT_URL`
     at the branch and promote it. Fastest, but **discards everything that
     happened since the timestamp**, including new enquiries. Enumerate what
     that is before choosing it.
   - _Partial recovery (usually correct):_ export only the affected rows from
     the branch and re-insert into production. Preserves everything else.

   ```bash
   # example: recover deleted tracks
   pg_dump "<branch-url>" --data-only --table=tracks > tracks.sql
   ```

6. **Confirm the site.** Publish something trivial and check it appears.
7. **Delete the branch** once resolved, and record the date and RTO in
   [`../backups.md`](../backups.md).

## Postgres — from the off-site dump

For when the Neon account or project itself is unavailable.

```bash
# fetch and decrypt
rclone copy r2:djf-backups/postgres/2026-09-10.dump.age ./
age -d -i ~/.config/age/djf.key 2026-09-10.dump.age > restore.dump

# inspect before restoring — always
pg_restore --list restore.dump | head -50

# restore into a NEW database, never over a live one
pg_restore --dbname="<new-db-url>" --no-owner --no-privileges restore.dump

# reapply the objects Prisma does not own
DIRECT_URL="<new-db-url>" pnpm --filter @dj/db post-migrate
```

Step four is easy to forget and important: `pg_dump` captures the objects, but
if you restore a schema-only baseline you must re-run `post-migrate`.

## Cloudinary media

Media deletion is already defensive: two-phase, with a 30-day soft-delete
window before the nightly sweeper purges anything.

**If within 30 days:** the asset is still in Cloudinary. Clear `deletedAt` on
the `MediaAsset` row and it is live again.

```sql
UPDATE media_assets SET "deletedAt" = NULL WHERE id = '<id>';
```

**If past 30 days, or the asset is gone from Cloudinary:**

1. Check the nightly manifest in the private backup repo for its `publicId`,
   version and checksum.
2. Restore from the weekly R2 sync:

   ```bash
   rclone copy r2:djf-media/djf/prod/personas/tnt/gallery ./recovered
   ```

3. Re-upload through admin so a fresh `MediaAsset` row is created with correct
   metadata, `blurDataUrl` and alt text. Do not insert a row by hand — the
   metadata is derived at upload for a reason.

## What cannot be restored

- **Enquiries submitted during an API outage.** There is no client-side queue.
  Be honest about this.
- **Access tokens.** Stateless and short-lived by design; users simply log in
  again.
- **The Next.js Data Cache.** Rebuilt on demand.
- **Content published between the restore timestamp and now**, if you choose a
  whole-database rollback. This is why partial recovery is usually correct.

## Drill checklist

Quarterly, and logged in [`../backups.md`](../backups.md):

- [ ] Branch from 24 hours ago
- [ ] Verify content presence and row counts
- [ ] `pnpm --filter @dj/db test` passes against the branch
- [ ] Record the observed RTO
- [ ] Delete the branch
