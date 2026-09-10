import { Prisma } from '@prisma/client';

import { getDbContext } from '../context.js';
import { isAuditedModel } from '../models.js';

/**
 * Audit-stamping extension.
 *
 * Populates `createdBy` / `updatedBy` from the ambient request context, so
 * attribution never has to be threaded through service signatures. The
 * AuditLog *rows* are written separately by the API's AuditInterceptor —
 * this extension only maintains the denormalised columns that make
 * "who last touched this?" a single-row read on any entity.
 *
 * See docs/02-architecture/backend.md
 */

/** Sentinel actor for seeds, cron jobs and migrations. */
export const SYSTEM_ACTOR = 'system';

type AnyArgs = { data?: unknown } & Record<string, unknown>;

function actorId(): string | undefined {
  const { userId, system } = getDbContext();
  if (userId != null) return userId;
  // Cron jobs and seeds are attributed rather than left as a misleading null.
  return system === true ? SYSTEM_ACTOR : undefined;
}

function stampCreate(data: unknown, actor: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => stampCreate(row, actor));
  }
  if (data == null || typeof data !== 'object') return data;

  const row = data as Record<string, unknown>;
  return {
    ...row,
    // Never overwrite an explicit value: importers and the restore flow set
    // createdBy deliberately to preserve original authorship.
    createdBy: row.createdBy ?? actor,
    updatedBy: row.updatedBy ?? actor,
  };
}

function stampUpdate(data: unknown, actor: string): unknown {
  if (data == null || typeof data !== 'object') return data;
  const row = data as Record<string, unknown>;
  return { ...row, updatedBy: row.updatedBy ?? actor };
}

export const auditExtension = Prisma.defineExtension({
  name: 'auditStamp',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!isAuditedModel(model)) return query(args);

        const actor = actorId();
        if (actor == null) return query(args);

        const a = args as AnyArgs;

        switch (operation) {
          case 'create':
          case 'createMany':
          case 'createManyAndReturn':
            return query({ ...a, data: stampCreate(a.data, actor) } as typeof args);

          case 'update':
          case 'updateMany':
            return query({ ...a, data: stampUpdate(a.data, actor) } as typeof args);

          case 'upsert': {
            const u = a as { create?: unknown; update?: unknown };
            return query({
              ...a,
              create: stampCreate(u.create, actor),
              update: stampUpdate(u.update, actor),
            } as typeof args);
          }

          default:
            return query(args);
        }
      },
    },
  },
});
