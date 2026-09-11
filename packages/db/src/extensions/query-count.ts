import { Prisma } from '@prisma/client';

import { getDbContext } from '../context.js';

/**
 * Counts Prisma operations per request.
 *
 * The N+1 canary. Implemented as a client **extension** rather than via
 * `$on('query')` for a specific reason: Prisma emits query events through an
 * EventEmitter, which runs the listener outside the caller's
 * AsyncLocalStorage scope — so the request context is always empty there and
 * the count cannot be attributed to anything. An extension hook runs
 * synchronously in the calling context, where the store is live.
 *
 * Counts logical operations, not SQL statements: one `findMany` with three
 * includes counts as one even though `relationJoins` may emit a single query
 * or a handful. That is the more useful number — it maps to what the code
 * asked for rather than to Prisma's execution strategy.
 */
export const queryCountExtension = Prisma.defineExtension({
  name: 'queryCount',
  query: {
    $allModels: {
      $allOperations({ args, query }) {
        const context = getDbContext();
        // Mutating the live store is the point; see DbRequestContext.
        context.queryCount = (context.queryCount ?? 0) + 1;
        return query(args);
      },
    },
  },
});
