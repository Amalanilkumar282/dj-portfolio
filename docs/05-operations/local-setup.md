# Local setup

Target: clone to running in under ten minutes.

## Prerequisites

| Tool           | Version    | Notes                                 |
| -------------- | ---------- | ------------------------------------- |
| Node           | 22+        | `.nvmrc` pins 22. Verified on 24.     |
| pnpm           | 11+        | `corepack enable`                     |
| Docker Desktop | any recent | For Postgres. See alternatives below. |
| Git            | any        |                                       |

## 1. Install

```bash
pnpm install
```

## 2. Start Postgres

```bash
docker compose up -d
docker compose ps          # postgres should be healthy
```

Optional profiles:

```bash
docker compose --profile mail up -d     # Mailpit — catches outbound email
docker compose --profile redis up -d    # not needed at launch (ADR 0006)
```

Mailpit UI: <http://localhost:8025>. Local development never sends real email
through Resend.

### If you do not have Docker

Two alternatives, both fine:

**A Neon development branch.** Create a branch in the Neon console and put both
URLs in `packages/db/.env`. Point `DIRECT_URL` at the **unpooled** endpoint —
migrations need a session.

**Any local Postgres 16+.** Create a `djf` database and a `djf_shadow` database
(the second is only needed for `db:migrate:check`), then set the URLs
accordingly.

> **As of 2026-09-10 this machine has neither Docker nor a local Postgres.**
> Phase 1 was verified against a throwaway embedded Postgres 18.4 in the
> scratchpad. `docker-compose.yml` is written but has never been executed here.
> See [`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) gap #1.

## 3. Environment files

Copy each example and fill in what you have:

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example    apps/api/.env.local
cp apps/web/.env.example    apps/web/.env.local
cp apps/admin/.env.example  apps/admin/.env.local
```

The defaults point at the Docker Postgres and work out of the box. Cloudinary,
Resend and Turnstile keys are placeholders — Phases 5, 6 and 8 need real ones.

Generate the secrets:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
openssl rand -base64 32   # COOKIE_SECRET, REVALIDATE_SECRET, API_KEY
```

`REVALIDATE_SECRET` and `API_KEY` must be **identical** in `apps/api` and
`apps/web`. A mismatch is the most common cause of "I published but nothing
changed".

Check for missing or undocumented variables:

```bash
pnpm check:env
```

## 4. Database

```bash
pnpm db:generate    # Prisma client
pnpm db:migrate     # applies migrations, then post-migrate SQL
pnpm db:seed        # system + admin + content + demo
```

`pnpm db:seed` in development runs all four layers. Expected output:

```
permissions: 104          venues: 7
roles: 3                  programs: 6
genres: 22                tracks: 19
personas: 4               playlists: 4
redirects: 15             testimonials: 8
                          services: 6, faqs: 10, gear: 11
                          events: 60, inquiries: 40  [demo — synthetic]
```

Default admin login: `admin@djfelicitous.com` / `ChangeMe!12345` (from
`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`).

Browse the data:

```bash
pnpm db:studio
```

## 5. Run

```bash
pnpm dev                                  # everything
pnpm --filter @dj/api dev                 # API only     :4000
pnpm --filter @dj/web dev                 # public       :3000
pnpm --filter @dj/admin dev               # admin        :3001
```

|               | URL                              |
| ------------- | -------------------------------- |
| Public site   | <http://localhost:3000>          |
| Admin         | <http://localhost:3001>          |
| API           | <http://localhost:4000/api/v1>   |
| Swagger       | <http://localhost:4000/api/docs> |
| Prisma Studio | <http://localhost:5555>          |
| Mailpit       | <http://localhost:8025>          |

---

## Command reference

```bash
# quality
pnpm lint          pnpm typecheck      pnpm test
pnpm format        pnpm format:check

# database
pnpm db:generate       pnpm db:migrate         pnpm db:migrate:deploy
pnpm db:migrate:check  pnpm db:seed            pnpm db:studio
pnpm --filter @dj/db post-migrate

# scoped seeds
pnpm --filter @dj/db seed:system
pnpm --filter @dj/db seed:content
pnpm --filter @dj/db seed:demo
```

### Resetting the database

`prisma migrate reset` is destructive and Prisma blocks AI agents from running
it without explicit consent. To reset deliberately:

```bash
cd packages/db
pnpm exec prisma migrate reset --force --skip-seed
pnpm post-migrate
pnpm seed
```

Or, since `docker compose` owns the volume:

```bash
docker compose down -v && docker compose up -d
pnpm db:migrate && pnpm db:seed
```

---

## Troubleshooting

**`Environment variable not found: DIRECT_URL`** — `packages/db/.env` is
missing. Copy the example.

**`Can't reach database server`** — `docker compose ps`. If postgres is not
healthy, `docker compose logs postgres`.

**`cannot insert multiple commands into a prepared statement`** — you are
running the post-migrate SQL through Prisma. It needs the `pg` client; use
`pnpm --filter @dj/db post-migrate`.
[ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md).

**Prisma types missing after pulling** — `pnpm db:generate`. The client is
generated, not committed.

**`db:migrate:check` reports drift after editing the schema** — you edited
`schema.prisma` without generating a migration. Run `pnpm db:migrate`. If the
drift is a partial index or CHECK constraint, it belongs in
`prisma/sql/post-migrate.sql`, not the datamodel.

**A published change does not appear on the site** — walk the checklist in
[`../02-architecture/caching-and-revalidation.md`](../02-architecture/caching-and-revalidation.md).
It is usually a `REVALIDATE_SECRET` mismatch.

**Integration tests fail with connection errors** — they need a real Postgres.
CI uses Testcontainers; locally they use `packages/db/.env`.
