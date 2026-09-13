import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context, carried in AsyncLocalStorage.
 *
 * The audit extension reads `userId` from here to stamp `createdBy` /
 * `updatedBy`, which is why no service method needs an actor parameter
 * threaded through its signature. The API populates this in a global
 * interceptor; seeds and cron jobs populate it with a system actor.
 *
 * See docs/02-architecture/backend.md
 */
export interface DbRequestContext {
  /** Acting user id, or undefined for unauthenticated/system operations. */
  userId?: string | undefined;
  /** Correlation id, echoed into AuditLog rows and X-Request-Id. */
  requestId?: string | undefined;
  /**
   * Set by seeds, migrations and cron jobs. Audit rows attribute these to
   * "system" rather than leaving a misleading null actor.
   */
  system?: boolean | undefined;
  /**
   * Escape hatch for the nightly orphan sweeper, which must issue real
   * DELETEs. Nothing else may set it. See extensions/soft-delete.ts
   */
  allowHardDelete?: boolean | undefined;
  /**
   * Prisma operations issued during this request.
   *
   * Incremented by `queryCountExtension`. Lives on the context rather than in
   * a side map because that is the only place guaranteed to be reachable from
   * inside a Prisma extension hook — and unlike `$on('query')`, an extension
   * hook DOES run in the caller's async context, which is what makes the
   * count attributable to a request at all.
   */
  queryCount?: number | undefined;
}

const storage = new AsyncLocalStorage<DbRequestContext>();

/**
 * Runs `fn` with `context` visible to the Prisma extensions.
 *
 * Always returns a promise, and always awaits `fn` *inside* the storage
 * scope. That second detail is load-bearing rather than stylistic: Prisma's
 * `PrismaPromise` is lazy and does not execute until it is awaited, so
 *
 *     storage.run(ctx, () => prisma.venue.create(...))   // WRONG
 *
 * hands the un-started promise back out of the scope, the scope exits, and
 * the query then runs with no context — silently dropping the audit stamp
 * with no error anywhere. Awaiting within the scope keeps it alive until the
 * query has actually run.
 */
export async function runWithDbContext<T>(
  context: DbRequestContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return storage.run(context, async () => fn());
}

/**
 * Synchronous variant, for framework integration only.
 *
 * Use this **only** where the caller itself keeps the scope open for the whole
 * duration of the work — in practice that means Express middleware, where
 * `fn` is `next()` and every downstream handler runs inside the callback.
 *
 * Everywhere else use `runWithDbContext`. This version does not await, so
 * handing it an unstarted `PrismaPromise` reintroduces exactly the bug the
 * async version exists to prevent: the query runs after the scope has exited
 * and the audit stamp silently becomes null.
 *
 * The returned context object is the live store, so a caller that learns the
 * actor later — an auth guard, say — can mutate it in place rather than
 * opening a second nested scope.
 */
export function runWithDbContextSync<T>(context: DbRequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Reads the ambient context.
 *
 * Returns a **live reference** to the store when one is open, so mutating the
 * result updates the context for the rest of the request. That is how the auth
 * guard attaches `userId` after the middleware has already opened the scope.
 * Outside a request it returns a fresh throwaway object, and mutating that has
 * no effect — which is the correct behaviour, not a bug.
 */
export function getDbContext(): DbRequestContext {
  return storage.getStore() ?? {};
}

/**
 * Runs `fn` with hard deletes permitted, inheriting the surrounding context.
 *
 * Deliberately narrow and deliberately noisy to read at the call site: the
 * only legitimate caller is the media orphan sweeper, purging assets that
 * were soft-deleted more than 30 days ago.
 */
export async function runWithHardDelete<T>(fn: () => T | Promise<T>): Promise<T> {
  return runWithDbContext({ ...getDbContext(), allowHardDelete: true }, fn);
}
