# Code style

Formatting is Prettier's job and is not up for discussion. This document covers
the decisions Prettier cannot make.

## The four custom lint rules

These are not style preferences. Each one encodes a specific failure of the
site being replaced. They live in `packages/config-eslint/rules/`.

### `dj/no-client-in-route-files`

Bans `'use client'` in `app/**/page.tsx` and `app/**/layout.tsx`.

_Why:_ the legacy site marked every page as a Client Component, which cost it
all server rendering and made per-route `metadata` impossible — the single
largest cause of its SEO failure. Client behaviour belongs in leaf islands.

_If it fires:_ extract the interactive part into its own component and import
it. That component can be a client component; the page stays a server one.

### `dj/no-raw-color-literals`

Bans hex, `rgb()`, `hsl()`, `oklch()` in `apps/*` and `packages/ui` components.

_Why:_ three competing colour systems across three CSS files, with components
referencing tokens that resolved to nothing.

_If it fires:_ use a semantic token. If none fits, add one to `theme.css` — see
[`../03-design-system/tokens.md`](../03-design-system/tokens.md). Do not
disable the rule.

### `dj/prisma-only-in-repositories`

Restricts `@prisma/client` and `PrismaService` imports to `*.repository.ts`,
`infra/`, `*.int-spec.ts` and `seed/`.

_Why:_ one data-access seam per aggregate is what makes the include-allowlist
and N+1 guards enforceable at all. Type-only imports are exempt, since they
carry no runtime coupling.

### `dj/no-unsafe-prisma-raw`

Bans `$queryRawUnsafe` and `$executeRawUnsafe`.

_Why:_ they do not parameterise. The legitimate raw sites use `Prisma.sql`
tagged templates.

_The one exception_ is `packages/db/scripts/post-migrate.ts`, which carries a
targeted `eslint-disable-next-line`. It executes a trusted, version-controlled
DDL file with no interpolation. That is why it is a line-level disable and not
a relaxed rule.

## Other rules worth knowing

| Rule                                             | Reason                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@typescript-eslint/no-floating-promises`        | The top source of silent failures in Nest services and server actions alike                                                          |
| `@typescript-eslint/prefer-nullish-coalescing`   | `??` not `                                                                                                                           |     | `, because `0`and`''`are meaningful for`bpm`, `sortIndex`, `playCount` |
| `@typescript-eslint/switch-exhaustiveness-check` | Paired with `assertNever`, a new enum value becomes a compile error rather than a runtime surprise                                   |
| `@typescript-eslint/consistent-type-imports`     | `verbatimModuleSyntax` is on                                                                                                         |
| `no-restricted-imports` in `packages/ui`         | Shared packages must not import from `apps/*`                                                                                        |
| `no-restricted-syntax` (transitions)             | Never transition `width`/`height`/`top`/`left` — layout thrash. See [`../03-design-system/motion.md`](../03-design-system/motion.md) |
| `import-x/no-cycle`                              | Cycles break Turbo caching and tree-shaking                                                                                          |

## TypeScript

`packages/config-ts/base.json` turns on more than `strict`:

- `noUncheckedIndexedAccess` — `arr[0]` is `T | undefined`. Verbose, and it
  catches real bugs.
- `exactOptionalPropertyTypes` — `{ a?: string }` will not accept
  `{ a: undefined }`. This is why the codebase writes
  `...(x != null ? { key: x } : {})` rather than `{ key: x }`.
- `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noUnusedLocals`, `noUnusedParameters`.
- `verbatimModuleSyntax` — type imports must say `type`.

**Never `any`.** Use `unknown` and narrow. Where a library forces it, wrap it
in one typed function rather than spreading `any` outward.

**Never a non-null assertion (`!`) in application code**, except on
`process.env.X!` immediately after a validated config check. Tests may use it
freely.

## Naming

| Thing                | Convention                             | Example                               |
| -------------------- | -------------------------------------- | ------------------------------------- |
| Files                | kebab-case                             | `booking-inquiry.service.ts`          |
| React components     | PascalCase file and export             | `TrackCard.tsx`                       |
| Nest classes         | PascalCase + role suffix               | `EventsAdminController`               |
| Types and interfaces | PascalCase, **no `I` prefix**          | `PersonaDetail`                       |
| Zod schemas          | PascalCase, matching the inferred type | `const PersonaDetail = z.object(...)` |
| Booleans             | `is` / `has` / `can` / `should`        | `isRiderItem`, `hasMore`              |
| Enums and members    | SCREAMING_SNAKE members                | `ContentStatus.PUBLISHED`             |
| Cache tags           | colon-namespaced                       | `persona:tnt`                         |
| Permissions          | `resource:action`                      | `event:publish`                       |

## Comments

Explain **why**, not what. `// increment the counter` above `count++` is noise;
`// isPast is maintained by cron so this stays a boolean predicate — Postgres
rejects non-immutable now() in an index predicate` is the reason the code looks
odd.

Comment when: the code is surprising, a constraint is non-obvious, a
workaround exists, or a subtle bug is being avoided. `packages/db/src/context.ts`
is the model — it documents the lazy-`PrismaPromise` trap because otherwise
someone will "simplify" the function and silently break audit stamping.

Do not leave commented-out code. Git has it.

## Error handling

- Throw typed errors, never bare strings.
- API errors are RFC 9457 problem details. See
  [`../02-architecture/api-conventions.md`](../02-architecture/api-conventions.md).
- Never swallow an error to make a test pass. If a `catch` is empty, say why in
  a comment.
- Frontend fetches fail loud: contract drift throws a 502 with a logged diff
  rather than rendering `undefined`.

## Dates and money

**Always** use `@dj/utils`. Never hand-roll either.

- Every timestamp is stored UTC and displayed IST. `formatIstDateTime`,
  `formatEventDateRange`, `isoWithIstOffset`.
- `isoWithIstOffset` for JSON-LD — a bare `Z` makes Google show Indian gigs at
  the wrong local time.
- `formatINR` uses `en-IN` grouping, so 250000 renders as ₹2,50,000, not
  ₹250,000.
- `formatPriceRange` returns "On request" for a null band. That is a real state,
  not a missing value.
