/**
 * @dj/db - the data layer.
 *
 * Everything below is re-exported from the generated Prisma client, so
 * consumers import enums and types from `@dj/db` and never from
 * `@prisma/client` directly. That keeps the generated-client path an
 * implementation detail of this package.
 */

// Generated enums and model types.
export * from '@prisma/client';

// Extended client factory - the only sanctioned way to construct a client.
export { createPrismaClient } from './client.js';
export type { CreatePrismaClientOptions, ExtendedPrismaClient } from './client.js';

// Request context, read by the audit and soft-delete extensions.
export { runWithDbContext, getDbContext, runWithHardDelete } from './context.js';
export type { DbRequestContext } from './context.js';

// Publish-state helpers, composed by public controllers.
export { publishedWhere, publishedOnly } from './extensions/publish.js';
export type { PublishedWhereOptions } from './extensions/publish.js';

export { SYSTEM_ACTOR } from './extensions/audit.js';

// Model capability registries.
export {
  SOFT_DELETE_MODELS,
  AUDITED_MODELS,
  PUBLISHABLE_MODELS,
  isSoftDeleteModel,
  isAuditedModel,
  isPublishableModel,
} from './models.js';
export type { SoftDeleteModel, AuditedModel, PublishableModel } from './models.js';
