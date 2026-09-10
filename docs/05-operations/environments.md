# Environments

|                | Host                            | Database                   | Cloudinary folder | Email                    | Indexed |
| -------------- | ------------------------------- | -------------------------- | ----------------- | ------------------------ | ------- |
| **Local**      | localhost 3000 / 3001 / 4000    | Docker Postgres            | `djf-dev`         | Mailpit (nothing leaves) | No      |
| **Preview**    | Vercel preview + Railway PR env | Neon branch `preview/pr-N` | `djf-preview`     | Resend test mode         | **No**  |
| **Production** | djfelicitous.com                | Neon `main`                | `djf-prod`        | Resend live              | Yes     |

## Isolation guarantees

**Preview and production never share a database.** CI creates a Neon branch per
PR from `main`, so migrations rehearse against production-shaped data, and
drops it on merge.

**Cloudinary folders are namespaced by environment** (`djf/{env}/...`), so a
development upload cannot appear on the live site and a development delete
cannot remove a production asset.

**Preview deploys are never indexed.** `robots.ts` disallows everything unless
`VERCEL_ENV === 'production'`. Without that, preview URLs compete with the real
site in search results — a genuinely damaging and easily-missed mistake.

**Local email never leaves the machine.** Mailpit captures it at
<http://localhost:8025>.

## Seed behaviour by environment

| Layer     | Local | Preview     | Production                                |
| --------- | ----- | ----------- | ----------------------------------------- |
| `system`  | yes   | yes         | **yes, every deploy**                     |
| `admin`   | yes   | yes         | guarded — refuses if a SUPER_ADMIN exists |
| `content` | yes   | yes         | **refuses**                               |
| `demo`    | yes   | **refuses** | **refuses**                               |

`system` is idempotent and upserts on natural keys, which is how new
permissions and redirects reach production. It deliberately does not overwrite
`SiteSettings`, because the artist may have edited it in admin.

`content` refuses in production because loading harvested development copy
would overwrite published content. `demo` refuses outside development because
its data is explicitly fake and prefixed `[DEMO]`.

## Feature flags

`SiteSettings` carries flags so a phase can ship dark and be switched on
without a deploy:

- `featureBlogEnabled` — off until there is content. An empty `/blog` in the
  sitemap is worse than no `/blog`.
- `featureNewsletterEnabled` — off until Resend audiences are configured.
- `featureShopEnabled` — a placeholder; a shop is a non-goal.
- `bookingFormEnabled` — kill switch if the form is ever abused.
- `maintenanceMode` — serves a maintenance page.

## Ports

| Service           | Port        |
| ----------------- | ----------- |
| `apps/web`        | 3000        |
| `apps/admin`      | 3001        |
| `apps/api`        | 4000        |
| Postgres          | 5432        |
| Prisma Studio     | 5555        |
| Mailpit UI / SMTP | 8025 / 1025 |
| Redis (profile)   | 6379        |

## Promotion path

```
feature branch → PR (preview + Neon branch) → review → merge to main → production
```

There is no staging environment. Preview deploys with a production-shaped Neon
branch cover it, at a fraction of the cost and maintenance. Add staging only if
a change ever genuinely cannot be validated on a preview.
