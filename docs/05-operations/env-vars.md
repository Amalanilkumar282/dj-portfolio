# Environment variables

Authoritative inventory. `apps/api/src/config/env.schema.ts` is the runtime
source of truth for the API; `pnpm check:env` enforces key parity between every
`.env.example` and its schema, so **a variable cannot be added to code without
being documented here and in the example file.**

## Rules

1. Secrets are never committed. `.env.example` files carry placeholders and
   **are** committed.
2. `NEXT_PUBLIC_*` is visible in the browser. Never put a secret behind that
   prefix.
3. The API validates its environment with Zod and **fails to boot** on invalid
   config. A container that starts with a missing `RESEND_API_KEY` and silently
   drops booking emails is a business bug, not a config bug.
4. Shared secrets must match exactly across apps. See the table below.

## Must match across apps

| Variable            | Apps            | Symptom of mismatch                                                                                |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `REVALIDATE_SECRET` | api, web        | Published changes never appear. 401 in the webhook log. **The most common cause of that symptom.** |
| `API_KEY`           | api, web, admin | Every API call 401s                                                                                |
| `PREVIEW_TOKEN`     | api, web        | Draft preview redirects to a 401                                                                   |

---

## `packages/db/.env`

Prisma CLI only — migrate, studio, seed. The API reads its own file at runtime.

| Variable                 | Notes                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`           | Pooled. Neon `-pooler` endpoint with `?pgbouncer=true&connection_limit=10&pool_timeout=20` |
| `DIRECT_URL`             | **Unpooled.** Migrations and DDL need a session.                                           |
| `SHADOW_DATABASE_URL`    | Only for `db:migrate:check`                                                                |
| `ADMIN_SEED_EMAIL`       | First SUPER_ADMIN                                                                          |
| `ADMIN_SEED_PASSWORD`    | ≥12 characters, or the seed throws                                                         |
| `CLOUDINARY_ROOT_FOLDER` | Namespace for seeded uploads, e.g. `djf-dev`                                               |

## `apps/api/.env.local`

| Variable                 | Required | Notes                                                                                                                                                           |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`               | yes      |                                                                                                                                                                 |
| `PORT`                   |          | default 4000                                                                                                                                                    |
| `API_PUBLIC_URL`         | yes      | Used in Cloudinary webhook callbacks                                                                                                                            |
| `LOG_LEVEL`              |          | `info` in production                                                                                                                                            |
| `SWAGGER_ENABLED`        |          | **`false` in production**                                                                                                                                       |
| `DATABASE_URL`           | yes      | pooled                                                                                                                                                          |
| `DIRECT_URL`             | yes      | unpooled                                                                                                                                                        |
| `JWT_ACCESS_SECRET`      | yes      | ≥48 chars. `openssl rand -base64 48`                                                                                                                            |
| `JWT_ACCESS_TTL`         |          | default `15m`                                                                                                                                                   |
| `JWT_REFRESH_SECRET`     | yes      | ≥48 chars, **different** from the access secret                                                                                                                 |
| `JWT_REFRESH_TTL_DAYS`   |          | default 30                                                                                                                                                      |
| `COOKIE_SECRET`          | yes      | ≥32 chars                                                                                                                                                       |
| `COOKIE_DOMAIN`          | yes      | `admin.djfelicitous.com` in production — scoping the session away from the public origin is deliberate ([ADR 0002](../01-decisions/0002-separate-admin-app.md)) |
| `CORS_ORIGINS`           | yes      | Comma-separated. Never `*` — credentials are enabled.                                                                                                           |
| `TOTP_ENCRYPTION_KEY`    | yes      | 32 bytes. AES-256-GCM for `totpSecret` at rest.                                                                                                                 |
| `CLOUDINARY_CLOUD_NAME`  | yes      |                                                                                                                                                                 |
| `CLOUDINARY_API_KEY`     | yes      |                                                                                                                                                                 |
| `CLOUDINARY_API_SECRET`  | yes      | **Server only. Never reaches a frontend.**                                                                                                                      |
| `CLOUDINARY_ROOT_FOLDER` | yes      | `djf-prod` / `djf-dev`                                                                                                                                          |
| `RESEND_API_KEY`         | yes      | starts `re_`                                                                                                                                                    |
| `MAIL_FROM`              | yes      | On a domain with SPF, DKIM and DMARC                                                                                                                            |
| `BOOKING_NOTIFY_TO`      | yes      | Where booking enquiries go                                                                                                                                      |
| `WEB_BASE_URL`           | yes      | Revalidation webhook target                                                                                                                                     |
| `REVALIDATE_SECRET`      | yes      | ≥32 chars. Must match `apps/web`.                                                                                                                               |
| `API_KEY`                | yes      | Shared secret for server-to-server calls                                                                                                                        |
| `PREVIEW_TOKEN`          | yes      | Draft mode                                                                                                                                                      |
| `TURNSTILE_SECRET_KEY`   | yes      | Booking form                                                                                                                                                    |
| `ANALYTICS_HASH_SALT`    | yes      | Salt for `PageView.visitorHash` and `ipHash`. Rotating it breaks visitor-uniqueness continuity, so rotate deliberately.                                         |
| `SENTRY_DSN`             |          |                                                                                                                                                                 |
| `REDIS_URL`              |          | Absent means in-memory cache ([ADR 0006](../01-decisions/0006-no-redis-at-launch.md))                                                                           |

## `apps/web/.env.local`

| Variable                            | Notes                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`              | Canonical origin. Wrong value breaks every canonical URL, OG image and sitemap entry. |
| `API_INTERNAL_URL`                  | Server-side only, e.g. `http://localhost:4000/api/v1`                                 |
| `API_KEY`                           | Server-side only. Must match the API.                                                 |
| `REVALIDATE_SECRET`                 | Must match the API                                                                    |
| `PREVIEW_TOKEN`                     | Must match the API                                                                    |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public by design — it is in every image URL                                           |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`    | Public by design                                                                      |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`      |                                                                                       |
| `NEXT_PUBLIC_GA_ID`                 | Loaded only after consent                                                             |

There is deliberately **no `NEXT_PUBLIC_API_URL`.** The public browser never
calls the API — that keeps the key server-side, avoids CORS and keeps the
origin cacheable. If you find yourself wanting this variable, reconsider the
approach.

## `apps/admin/.env.local`

| Variable                            | Notes                                                                |
| ----------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_ADMIN_URL`             |                                                                      |
| `NEXT_PUBLIC_API_URL`               | Admin **does** call the API from the browser, for optimistic updates |
| `API_INTERNAL_URL`                  | Server-side route guards                                             |
| `API_KEY`                           | Server-side only                                                     |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |                                                                      |
| `CLOUDINARY_UPLOAD_PRESET`          | Referenced in signed params                                          |

---

## Generating secrets

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
openssl rand -base64 32   # COOKIE_SECRET, REVALIDATE_SECRET, API_KEY,
                          # PREVIEW_TOKEN, ANALYTICS_HASH_SALT
openssl rand -hex 32      # TOTP_ENCRYPTION_KEY
```

## Where production values live

| Platform         | Holds                                    |
| ---------------- | ---------------------------------------- |
| Railway          | Everything in the API table              |
| Vercel (`web`)   | The web table                            |
| Vercel (`admin`) | The admin table                          |
| 1Password vault  | Master copy, plus an offline sealed copy |

`gitleaks` runs in CI. The legacy repository had a **live-looking Resend API
key committed** in `djfelicitous/.env.local` — see
[`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) gap #3. Rotate it.

## Adding a variable

1. Add it to `apps/<app>/.env.example` with a placeholder and a comment.
2. Add it to `env.schema.ts` with a Zod validator — and a `.min()` if it is a
   secret.
3. `pnpm check:env` must pass.
4. Add it to the relevant table above.
5. Set it in Railway or Vercel **before** merging, or the deploy fails to boot.
   Failing to boot is the intended behaviour.
