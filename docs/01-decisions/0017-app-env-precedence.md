# 0017 — Each app applies its own env files, with override, before anything else

**Status:** Accepted · **Date:** 2026-09-11 (during Phase 2)

## Context

This cost several hours, produced a symptom that pointed nowhere near the
cause, and will absolutely happen again to whoever changes the boot sequence.

`apps/api/.env.local` set a `DATABASE_URL` on port 55432. The API dialled
**`localhost:5432`** instead — a port nothing was listening on — and reported a
connection error naming an address that appeared in no file the app had been
told to read.

Three mechanisms combine:

1. **`@prisma/client` loads dotenv itself, at require time.** Importing it
   walks up looking for a `.env`, finds `packages/db/.env` (which exists so
   that `prisma migrate` and the seeds work standalone), and applies it.
2. **That happens before `ConfigModule.forRoot()`.** `import` statements are
   hoisted and evaluated before any application code, so by the time Nest
   reads its own configuration, `process.env.DATABASE_URL` is already set.
3. **dotenv never overwrites an existing value.** `ConfigModule` then loads
   `.env.local`, sees `DATABASE_URL` is already populated, and leaves the
   sibling package's value in place.

So the app read a _different package's_ database configuration, silently, with
correct-looking config files on disk. Verified with a probe:
`BEFORE require @dj/db: (unset)` → `AFTER: postgresql://…localhost:5432`.

## Decision

`apps/api/src/bootstrap-env.ts` runs as the **first import** in `main.ts`,
before anything can require `@prisma/client`. It:

1. Snapshots the real platform environment (whatever Railway, Docker or the
   shell actually set).
2. Loads `.env` then `.env.local` **with `override: true`**, so ascending
   priority works and the app's own files win over anything a dependency
   loaded.
3. Restores the platform snapshot on top, so a real deployment environment
   always beats a file that happens to be present in the image.

That ordering is the whole point: **files beat other packages' files; the
platform beats files.**

```ts
// src/main.ts — line 1. Do not move this below any other import.
import './bootstrap-env';
```

The same file is applied to the test suite through
`apps/api/test/setup-env.ts`, registered as a vitest `setupFiles` entry. The
e2e specs import `AppModule` directly and never load `main.ts`, so without
that the fix is silently absent under test — which is exactly how it was
rediscovered.

## Consequences

- Env precedence is explicit, documented and testable.
- **`import './bootstrap-env'` must stay the first import in `main.ts`.** Any
  import above it that transitively pulls in `@prisma/client` reintroduces the
  bug. Import-sorting tools are a real hazard here; the file carries a comment
  saying so.
- Any new entry point that boots the app — a worker, a CLI, a new test config
  — must apply it too.
- `packages/db/.env` stays, because Prisma's own CLI needs it. It is no longer
  able to leak into the API.

## Alternatives considered

**Delete `packages/db/.env`.** Then `prisma migrate`, `prisma studio` and the
seeds all need an explicitly exported `DATABASE_URL`, which makes the common
local workflow worse and would be worked around within a week.

**Give the packages different variable names.** Renaming to
`DB_PACKAGE_DATABASE_URL` breaks Prisma's convention and every piece of
documentation about it, to avoid a collision that is better solved by
controlling precedence once.

**Rely on `ConfigModule`'s `envFilePath`.** It is still configured, and it is
still not sufficient: it runs too late, and it does not override.
