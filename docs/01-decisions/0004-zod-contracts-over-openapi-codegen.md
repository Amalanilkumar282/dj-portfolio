# 0004 — Zod contracts as the single source of truth, not OpenAPI codegen

**Status:** Accepted · **Date:** 2026-09-10

## Context

The API and two frontends need to agree on every request and response shape.
The two standard approaches are OpenAPI-first with a client generator, or
schema-first with a shared runtime validation library.

## Decision

`packages/contracts` holds Zod schemas. They are the single definition, and
everything else is derived from them:

- NestJS DTOs and runtime request validation, via `nestjs-zod`'s `createZodDto`
- the generated OpenAPI document for Swagger
- inferred TypeScript types for `apps/web` and `apps/admin`
- `react-hook-form` resolvers, so client and server validate identically
- response parsing at the frontend fetch boundary

## Consequences

- **A breaking API change fails `pnpm typecheck` in CI before it can deploy.**
  This is the property the whole decision exists for.
- Zod refinements travel with the type: `budgetMax >= budgetMin` and
  "event date must be in the future" are expressed once and enforced in both
  places.
- The frontend gets **runtime** validation, so contract drift surfaces as a
  loud 502 with a logged diff rather than as `undefined` rendering silently.
- No codegen step, so no generated files to review or keep in sync.
- Cost: `packages/contracts` must not import from any app, and every DTO is a
  thin `createZodDto` wrapper rather than a hand-written class.

## Alternatives rejected

- **OpenAPI-first + generator.** Requires a build step; produces weaker types
  (no refinements, no branded types); and gives the frontend no runtime
  validation at all. OpenAPI is still emitted here — just derived rather than
  authored.
- **tRPC.** Superb DX, but it assumes a TypeScript client. It would make the
  API unusable to anything else and couples the transport to the language.
- **Hand-written types on both sides.** This is what drifts.
