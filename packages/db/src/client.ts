import { PrismaClient } from '@prisma/client';

import { auditExtension } from './extensions/audit.js';
import { softDeleteExtension } from './extensions/soft-delete.js';

/**
 * Extended Prisma client factory.
 *
 * The API wraps this in a Nest provider (`infra/prisma/prisma.service.ts`);
 * seeds and integration tests call it directly. Keeping construction here
 * means every consumer gets the soft-delete and audit guarantees — there is
 * no way to obtain a "raw" client by accident.
 *
 * See docs/02-architecture/data-model.md
 */

export interface CreatePrismaClientOptions {
  datasourceUrl?: string;
  /**
   * Emit a warning for any query slower than this. Sampled in production via
   * the caller; unset disables the listener entirely.
   */
  slowQueryMs?: number;
  log?: ('query' | 'info' | 'warn' | 'error')[];
}

export function createPrismaClient(options: CreatePrismaClientOptions = {}) {
  const { datasourceUrl, log = ['warn', 'error'] } = options;

  const base = new PrismaClient({
    ...(datasourceUrl != null ? { datasourceUrl } : {}),
    log: log.map((level) => ({ emit: 'event' as const, level })),
  });

  // Order matters: audit stamps `data` before soft-delete inspects `where`,
  // and soft-delete must be outermost so its delete dispatch sees already
  // stamped payloads.
  return base.$extends(auditExtension).$extends(softDeleteExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
