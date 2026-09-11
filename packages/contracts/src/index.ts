/**
 * @dj/contracts - Zod schemas as the single source of truth.
 *
 * One definition drives: NestJS DTOs and runtime validation, the generated
 * OpenAPI document, TypeScript types for both frontends, react-hook-form
 * resolvers, and response parsing at the web fetch boundary.
 *
 * A breaking API change therefore fails `pnpm typecheck` in CI before it can
 * deploy. See docs/01-decisions/0004-zod-contracts-over-openapi-codegen.md
 *
 * Resource contracts (persona, track, event, ...) are added in Phase 4
 * alongside the modules that serve them.
 */

export * from './common.js';
export * from './cache-tags.js';
export * from './auth.js';
export * from './content.js';
export * from './media.js';
export * from './site.js';
export * from './engagement.js';
