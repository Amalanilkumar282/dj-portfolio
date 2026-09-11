# 0016 — Shared packages build to CommonJS

**Status:** Accepted · **Date:** 2026-09-11 (during Phase 2)

## Context

`@dj/db`, `@dj/contracts` and `@dj/utils` are consumed by three very different
runtimes:

- `apps/api` — NestJS, compiled by `tsc` to **CommonJS**, with
  `emitDecoratorMetadata`. This is not a style choice: Nest's dependency
  injection reads constructor parameter types out of `design:paramtypes`
  metadata, which only the TypeScript/SWC decorator transform emits.
- `apps/web` and `apps/admin` — Next.js, which bundles ESM happily.
- `vitest` — ESM-first.

The packages were originally authored as ESM (`"type": "module"`, `exports`
pointing at `./src/*.ts`), letting the Next apps consume TypeScript sources
directly with no build step. That is pleasant in development and it does not
work for the API.

The failure was `Cannot find module 'D:\...\packages\db\src\client.js'`. A CJS
`require` of an ESM-declared package resolves the `exports` map, finds a
`.js` specifier that only exists as `.ts` on disk, and gives up. Pointing the
API at the source instead just moves the problem: a CJS `require` cannot load
ESM at all, and `tsc` will not down-level a dependency it does not own.

## Decision

The three packages consumed by the API build to CommonJS and publish `dist`.

- `packages/config-ts/cjs-lib.json` — a preset: `module: commonjs`,
  `declaration: true`, `composite: true`.
- `packages/{db,contracts,utils}/tsconfig.build.json` extends it.
- `"type": "module"` **removed** from those three `package.json` files.
- `exports` / `main` / `types` point at `./dist`.
- `build` is wired into the Turborepo graph, so the API's build depends on it.

`@dj/ui` keeps its ESM/source-only setup: it is consumed only by the Next
apps, which handle it natively.

## Consequences

- The API works, and DI metadata survives.
- A shared-package change now requires a build before the API sees it.
  `pnpm dev` runs the Turborepo watch graph, so this is transparent in
  practice, but a stale `dist` is a real failure mode: symptoms are a type
  that "should exist" being missing, or an export being `undefined` at
  runtime. **If a shared-package change appears not to take effect in the API,
  rebuild the package before debugging anything else.**
- CJS output means these packages cannot use top-level `await` or
  `import.meta`. Neither is currently used.
- Dual-publishing ESM + CJS was considered and rejected: it doubles the build
  matrix and invites the dual-package hazard, where two copies of a module
  produce objects that fail `instanceof` against each other. We hit exactly
  that class of bug with `zod` and `nestjs-zod` (see
  `common/validation-errors.ts`), and had no appetite for engineering more of
  it.

## Alternatives considered

**Make the API ESM.** Nest supports it, but `emitDecoratorMetadata` under
Node's ESM loader is still awkward, the ecosystem's guidance assumes CJS, and
several dependencies ship CJS-only. A large, ongoing risk to remove one build
step.

**Have the API import the TypeScript sources via a path alias.** Works for
`tsc` but not for the emitted JavaScript, which would still contain
unresolvable specifiers at runtime. It moves the failure from build to
production, which is strictly worse.
