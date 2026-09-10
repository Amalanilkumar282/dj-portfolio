# Migrations

Read [ADR 0015](../01-decisions/0015-post-migrate-sql-outside-migrations.md)
first. The split between `prisma/migrations/` and `prisma/sql/post-migrate.sql`
is the thing most likely to confuse you here.

## The two halves

|                               | Owner                        | Contents                                                                                                    | Drift-checked                  |
| ----------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `prisma/migrations/`          | **Prisma. Never hand-edit.** | Tables, columns, FKs, unique constraints, ordinary indexes, GIN trigram indexes, `CREATE EXTENSION pg_trgm` | Yes                            |
| `prisma/sql/post-migrate.sql` | Us                           | 14 partial indexes, the generated `searchVector` column + its GIN index, 12 CHECK constraints               | No — asserted by tests instead |

Anything expressible in the datamodel **must** go in the datamodel, so the
drift gate can see it. Trigram indexes are expressible:

```prisma
@@index([title(ops: raw("gin_trgm_ops"))], type: Gin)
```

`pg_trgm` itself is declared in the datasource block via the
`postgresqlExtensions` preview feature, so even `CREATE EXTENSION` is
Prisma-owned.

## Daily workflow

```bash
# 1. edit packages/db/prisma/schema.prisma
# 2. generate and apply, which also runs post-migrate
pnpm db:migrate
# Prisma prompts for a name -> add_playlist_stream_links

# 3. confirm no drift
pnpm db:migrate:check      # must print "No difference detected."
```

`db:migrate` and `db:migrate:deploy` both chain `post-migrate`, so the two
halves cannot drift apart in normal use.

### Adding a partial index or CHECK constraint

1. Append it to `prisma/sql/post-migrate.sql`. **It must be idempotent** —
   `CREATE INDEX IF NOT EXISTS`, or `DROP CONSTRAINT IF EXISTS` then `ADD
CONSTRAINT`. The file is re-applied after every deploy.
2. **Add an assertion to `src/__tests__/schema.int-spec.ts`.** This is not
   optional. Prisma cannot see these objects, so the test is the only thing
   standing between a skipped post-migrate step and a database that is quietly
   slow and permissive.
3. `pnpm --filter @dj/db post-migrate` then `pnpm --filter @dj/db test`.

Column names in raw SQL are **camelCase and quoted** —
[ADR 0014](../01-decisions/0014-camelcase-columns.md). `"startsAt"`, not
`starts_at`. Unquoted identifiers get folded to lowercase and will not match.

## Rules

1. **Never edit a merged migration.** It has already run somewhere. Write a new
   one.
2. **Never hand-write a file in `prisma/migrations/`.** That is what breaks the
   drift gate.
3. **Destructive changes are expand/contract, across two deploys:**
   - Deploy 1 — add the new nullable column, backfill, write to both.
   - Deploy 2 — switch reads, stop writing the old one.
   - Deploy 3 (a later release) — drop the old column.

   Dropping a column in the same deploy that stops using it means any
   in-flight request against the previous version fails.

4. **A migration touching more than ~1000 rows** gets a separate `-- @manual`
   data script, run apart from the DDL. A long-running `UPDATE` inside a
   migration holds locks and can stall the deploy.
5. **Migrations use `DIRECT_URL`.** DDL and advisory locks need a session, which
   PgBouncer transaction mode cannot hold —
   [ADR 0005](../01-decisions/0005-neon-pooled-no-accelerate.md).

## In CI

```bash
pnpm db:migrate:check
```

Runs `prisma migrate diff --from-migrations ./prisma/migrations
--to-schema-datamodel ./prisma/schema.prisma --shadow-database-url $SHADOW_DATABASE_URL
--exit-code`. Exit 2 means drift; the merge is blocked.

This catches exactly one very common, very expensive mistake: editing
`schema.prisma` and forgetting to generate a migration. The code then works
locally against a hand-modified database and fails on deploy.

CI also creates a Neon branch per PR (`preview/pr-N`), so migrations rehearse
against production-shaped data before they reach production.

## In production

Railway pre-deploy command:

```bash
prisma migrate deploy && pnpm post-migrate && pnpm seed:system
```

- `migrate deploy` is forward-only and never prompts.
- `post-migrate` is idempotent.
- `seed:system` is idempotent and upserts on natural keys. It is safe on every
  deploy and is how new permissions and redirects reach production. It
  deliberately does **not** overwrite `SiteSettings`, because the artist may
  have edited it.
- `seed:content` and `seed:demo` **refuse to run in production.**

## Seed layers

| Layer     | Environments          | Content                                                                                                   |
| --------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `system`  | all, incl. production | permissions, roles, settings singleton, genres, persona shells, redirects                                 |
| `admin`   | all, guarded          | first SUPER_ADMIN; refuses in production if one exists                                                    |
| `content` | dev, preview          | harvested legacy copy — personas, venues, programs, tracks, playlists, testimonials, services, FAQs, gear |
| `demo`    | dev only              | `faker`, fixed seed — 60 events, 40 inquiries, 500 page views                                             |

`system` creates the four personas as **DRAFT shells with identity only**. The
`content` layer fills in bios and media. That split is what stops a production
deploy inheriting development copy.

## Rollback

Prisma migrations are forward-only. To undo, write a new migration that
reverses the change.

To recover from a bad **data** migration, use Neon PITR — restore to a
timestamp on a branch, verify, then repoint. See
[`runbooks/restore.md`](runbooks/restore.md).

## A note for AI agents

`prisma migrate reset` is destructive and Prisma actively blocks agents from
running it without explicit user consent. **Do not work around that guard.** If
a reset is genuinely needed, explain what it destroys and ask.

For a throwaway database you created yourself, recreating the database directly
is the safer equivalent and does not touch anything of the user's.
