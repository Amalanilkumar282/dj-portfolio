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

/** Reads the ambient context. Returns an empty object outside a request. */
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
