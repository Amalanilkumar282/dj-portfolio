# Deployment

```
   djfelicitous.com ──────► Vercel: apps/web    (static + ISR + PPR)
   admin.djfelicitous.com ► Vercel: apps/admin  (force-dynamic, no-store)
   api.djfelicitous.com ──► Railway: apps/api   (Docker, 1 replica)
                    ┌──────────────┼──────────────┐
            Neon Postgres      Cloudinary       Resend
            (ap-southeast-1)
```

Railway and Neon both in **Singapore** — closest region to Bengaluru.
[ADR 0007](../01-decisions/0007-railway-for-api.md).

## Environments

|            | Branch | Database                   | Indexed                                                                      |
| ---------- | ------ | -------------------------- | ---------------------------------------------------------------------------- |
| Production | `main` | Neon `main`                | Yes                                                                          |
| Preview    | any PR | Neon branch `preview/pr-N` | **No** — `robots.ts` disallows everything when `VERCEL_ENV !== 'production'` |
| Local      | —      | Docker Postgres            | No                                                                           |

Preview branches are created by CI and dropped on merge, so migrations rehearse
against production-shaped data.

## API — Railway

Deploys from `main` via Dockerfile. **Pre-deploy command:**

```bash
prisma migrate deploy && pnpm post-migrate && pnpm seed:system
```

All three are idempotent and safe on every deploy. `post-migrate` must run —
without it the partial indexes and CHECK constraints are missing.
[ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md).

Health check: `/health/ready`. Railway holds traffic until it passes.

Config: 1 vCPU / 1GB, one replica, `ap-southeast-1`, `SWAGGER_ENABLED=false`,
`LOG_LEVEL=info`.

> **Before scaling past one replica**, add Redis and confirm every cron job
> takes its advisory lock. Two replicas without those means an incoherent cache
> and duplicate booking emails.

## Frontends — Vercel

Two projects from the same repository, with `turbo-ignore` as the ignored build
step so an API-only change does not rebuild either.

`apps/web`: framework Next.js, root `apps/web`, build
`pnpm turbo build --filter=@dj/web`.
`apps/admin`: the same with `@dj/admin`.

Domains: `djfelicitous.com` (plus `www` redirecting to apex) and
`admin.djfelicitous.com`.

## First-time production setup

1. **Neon** — project in `ap-southeast-1`. Copy the pooled and unpooled URLs.
   **Disable scale-to-zero in production**; a 500ms cold start on the first
   booking submission of the day is unacceptable. Enable PITR.
2. **Cloudinary** — create the folder structure and run the named-transformation
   bootstrap script. See
   [`../02-architecture/media-pipeline.md`](../02-architecture/media-pipeline.md).
3. **Resend** — verify the sending domain and publish SPF, DKIM and DMARC
   (`p=quarantine`). **Verify deliverability before launch** — a booking
   notification in a spam folder is the same as no notification.
4. **Railway** — new service from the repo, set every variable from
   [`env-vars.md`](env-vars.md), set the pre-deploy command, attach
   `api.djfelicitous.com`.
5. **Vercel** — the two projects above.
6. **DNS** — apex and `www` to Vercel, `admin` to Vercel, `api` to Railway.
7. **Secrets** — generate fresh ones. Never reuse a development secret.
8. **First admin** — set `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`, deploy,
   log in, **enrol TOTP immediately**, then remove the seed password variable.
9. **Verify:** `/health/ready` returns 200; `/api/docs` is **not** reachable;
   admin login works with 2FA; a test booking lands in the database and sends
   both emails; publishing in admin updates the public site within seconds.
10. **Search Console and Bing** — submit the sitemap. Confirm `robots.ts` is
    serving the production rules, not the preview ones.

## Rollback

**Frontend** — instant rollback in the Vercel dashboard.

**API** — redeploy the previous Railway deployment. **Check whether the bad
deploy ran a migration.** Prisma migrations are forward-only: reverting the
image does not revert the schema. If the schema changed incompatibly, roll
forward with a fix instead. This is why destructive changes are expand/contract
across two deploys — see [`migrations.md`](migrations.md).

**Database** — Neon PITR. See [`runbooks/restore.md`](runbooks/restore.md).

## Post-deploy checks

- `/health/ready` 200
- Sentry shows the new release, no error spike
- A public page loads and shows current content
- Admin login works
- Publish something trivial and confirm it appears within ~10 seconds

## Costs (approximate)

|            | Monthly             |
| ---------- | ------------------- |
| Vercel     | Free–$20            |
| Railway    | $5–20               |
| Neon       | Free–$19            |
| Cloudinary | Free tier initially |
| Resend     | Free–$20            |
| Domain     | ~$15/year           |

Roughly $10–80/month. The free tiers are viable at launch traffic, with Neon
scale-to-zero the first thing to pay for.
