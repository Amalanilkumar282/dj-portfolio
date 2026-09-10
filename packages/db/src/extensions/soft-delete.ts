import { Prisma } from '@prisma/client';

import { getDbContext } from '../context.js';
import { isSoftDeleteModel } from '../models.js';

/**
 * Soft-delete extension.
 *
 * Two guarantees, both structural rather than conventional:
 *
 *  1. `delete` / `deleteMany` on a soft-delete model are dispatched to
 *     `update` / `updateMany` setting `deletedAt`. No repository can issue a
 *     real DELETE by forgetting to, and no call site needs to remember.
 *  2. Every read on a soft-delete model is filtered to `deletedAt: null`
 *     unless the caller has explicitly expressed an opinion.
 *
 * Escape hatches, both narrow and explicit:
 *  - `runWithHardDelete()` — the nightly Cloudinary purge only.
 *  - Any explicit `deletedAt` filter, which the admin trash view uses to
 *    list recoverable rows.
 *
 * See docs/02-architecture/data-model.md
 */

/** True when the caller has already filtered on `deletedAt` themselves. */
function hasExplicitDeletedAtFilter(where: unknown): boolean {
  if (where == null || typeof where !== 'object') return false;
  const w = where as Record<string, unknown>;

  if ('deletedAt' in w) return true;

  // Respect a filter nested in a boolean combinator, so the trash view can
  // write `{ AND: [{ deletedAt: { not: null } }, ...] }`.
  for (const key of ['AND', 'OR', 'NOT'] as const) {
    const branch = w[key];
    if (Array.isArray(branch)) {
      if (branch.some(hasExplicitDeletedAtFilter)) return true;
    } else if (branch != null && hasExplicitDeletedAtFilter(branch)) {
      return true;
    }
  }

  return false;
}

/**
 * Operations whose `where` is narrowed to live rows.
 *
 * `findUnique` is included deliberately: without the predicate a soft-deleted
 * row stays reachable by id or slug, which is exactly how "deleted" content
 * leaks back onto a live page. Prisma allows extra scalar filters on
 * findUnique as long as a unique field is present.
 */
const FILTERED_OPERATIONS: ReadonlySet<string> = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
]);

type AnyArgs = { where?: Record<string, unknown> } & Record<string, unknown>;

/**
 * Delegate surface the extension needs. Typing it structurally avoids
 * depending on generated per-model delegate types, which do not exist until
 * `prisma generate` has run.
 */
interface SoftDeleteDelegate {
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
}

export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'softDelete',

    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!isSoftDeleteModel(model)) return query(args);

          const { allowHardDelete } = getDbContext();

          // --- 1. Dispatch deletes to soft deletes -------------------------
          if (!allowHardDelete && (operation === 'delete' || operation === 'deleteMany')) {
            const delegate = (client as unknown as Record<string, SoftDeleteDelegate>)[
              // Model keys on the client are camelCase: Persona -> persona.
              model.charAt(0).toLowerCase() + model.slice(1)
            ];

            if (!delegate) {
              throw new Error(`No Prisma delegate found for model "${model}".`);
            }

            const a = args as AnyArgs;
            const data = { deletedAt: new Date() };

            return operation === 'delete'
              ? delegate.update({ where: a.where, data })
              : delegate.updateMany({ where: { ...(a.where ?? {}), deletedAt: null }, data });
          }

          // --- 2. Narrow reads and updates to live rows --------------------
          if (FILTERED_OPERATIONS.has(operation)) {
            const a = args as AnyArgs;
            if (!hasExplicitDeletedAtFilter(a.where)) {
              return query({ ...a, where: { ...(a.where ?? {}), deletedAt: null } } as typeof args);
            }
          }

          return query(args);
        },
      },
    },

    model: {
      $allModels: {
        /**
         * Soft-deletes a row. `delete` is dispatched to the same thing, but
         * calling this reads more honestly at a call site.
         */
        softDelete<T>(this: T, where: unknown): Promise<unknown> {
          const ctx = Prisma.getExtensionContext(this) as unknown as {
            $name?: string;
          } & SoftDeleteDelegate;

          if (!isSoftDeleteModel(ctx.$name)) {
            throw new Error(`${String(ctx.$name)} has no deletedAt column.`);
          }
          return ctx.update({ where, data: { deletedAt: new Date() } });
        },

        /** Restores a soft-deleted row, for the admin trash view. */
        restore<T>(this: T, where: unknown): Promise<unknown> {
          const ctx = Prisma.getExtensionContext(this) as unknown as {
            $name?: string;
          } & SoftDeleteDelegate;

          if (!isSoftDeleteModel(ctx.$name)) {
            throw new Error(`${String(ctx.$name)} has no deletedAt column.`);
          }
          // The `deletedAt` filter is explicit so the read narrowing above
          // does not hide the very row being restored.
          return ctx.update({
            where: { ...(where as Record<string, unknown>) },
            data: { deletedAt: null },
          });
        },
      },
    },
  }),
);
