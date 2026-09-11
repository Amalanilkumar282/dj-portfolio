import { PrismaClient } from '@prisma/client';

import { auditExtension } from './extensions/audit.js';
import { queryCountExtension } from './extensions/query-count.js';
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

/** What a query event carries. Mirrors Prisma's own event shape. */
export interface PrismaQueryEvent {
  query: string;
  params: string;
  duration: number;
  target: string;
}

export interface CreatePrismaClientOptions {
  datasourceUrl?: string;
  log?: ('query' | 'info' | 'warn' | 'error')[];
  /**
   * Called for every query.
   *
   * Registered here rather than by the caller because `$extends` returns a
   * client **without** `$on` — extensions strip the event API, so a listener
   * attached after extending silently does not exist. This hook is the only
   * way to observe queries on an extended client.
   *
   * Requires `'query'` in `log`, or Prisma emits nothing.
   */
  onQuery?: (event: PrismaQueryEvent) => void;
}

export function createPrismaClient(options: CreatePrismaClientOptions = {}) {
  const { datasourceUrl, onQuery } = options;

  // `query` is added automatically when a listener is supplied, so a caller
  // cannot ask for query observation and silently get none.
  const log = options.log ?? ['warn', 'error'];
  const levels = onQuery && !log.includes('query') ? [...log, 'query' as const] : log;

  const base = new PrismaClient({
    ...(datasourceUrl != null ? { datasourceUrl } : {}),
    log: levels.map((level) => ({ emit: 'event' as const, level })),
  });

  if (onQuery) {
    base.$on('query', onQuery);
  }

  // Order matters: audit stamps `data` before soft-delete inspects `where`,
  // and soft-delete must be outermost so its delete dispatch sees already
  // stamped payloads.
  //
  // The query counter is outermost, so it counts what the application asked
  // for rather than the extra `update` the soft-delete dispatch issues
  // internally. Applied unconditionally rather than behind a flag: making it
  // optional would give this function a union return type and turn
  // `ExtendedPrismaClient` into a union for every consumer. The cost is one
  // map lookup and an increment per operation, and only development reads
  // the result.
  return base.$extends(auditExtension).$extends(softDeleteExtension).$extends(queryCountExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;
