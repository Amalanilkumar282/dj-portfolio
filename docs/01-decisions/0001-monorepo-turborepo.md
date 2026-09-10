# 0001 — pnpm workspaces + Turborepo monorepo

**Status:** Accepted · **Date:** 2026-09-10

## Context

Three applications (public site, admin, API) plus shared design tokens, shared
types and shared utilities. The types in particular need to be shared: the
whole point of the API contract work is that a breaking change fails
typechecking in the frontend before it can ship.

## Decision

A single repository: pnpm workspaces for linking, Turborepo for task
orchestration and caching, TypeScript project references for incremental
builds.

`apps/web`, `apps/admin`, `apps/api`; `packages/db`, `contracts`, `ui`,
`motion`, `media`, `seo`, `analytics`, `utils`, `config-ts`, `config-eslint`,
`config-tailwind`.

## Consequences

- A change to a contract breaks the consumer's typecheck in the same CI run.
- One `pnpm install`, one lint config, one formatter, one CI pipeline.
- Turbo's `--filter='...[origin/main]'` keeps CI to what actually changed.
- `packages/db/prisma/schema.prisma` is a `globalDependency`, so editing the
  schema correctly invalidates every downstream build.
- Vercel needs `turbo-ignore` so an API-only change does not rebuild both
  frontends.
- Contributors must understand workspace protocol (`workspace:*`) and that
  `packages/*` are consumed as TypeScript source, not built artifacts.

## Alternatives rejected

- **Separate repositories.** Contract drift becomes a runtime discovery instead
  of a compile-time one, and every shared change becomes a version bump and a
  publish.
- **Nx.** More capable than we need, and a larger conceptual surface for a
  project this size.
- **npm/yarn workspaces without Turborepo.** No task graph and no caching; CI
  would rebuild everything on every push.
