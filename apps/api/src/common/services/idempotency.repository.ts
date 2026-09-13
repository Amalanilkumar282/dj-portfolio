import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  userId?: string | undefined;
  path: string;
  expiresAt: Date;
}

/**
 * Storage for `Idempotency-Key` replay.
 *
 * Named `*.repository.ts` deliberately: that suffix is what the
 * `dj/prisma-only-in-repositories` lint rule permits Prisma access in. It
 * lives under `common/` rather than in a feature module because the
 * interceptor that uses it is global.
 */
@Injectable()
export class IdempotencyRepository {
  private readonly logger = new Logger(IdempotencyRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async find(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.client.idempotencyKey.findUnique({ where: { key } });

    // An expired row is treated as absent rather than deleted here. The
    // nightly prune job removes it; doing a write on a read path would add
    // latency to every idempotent request for no benefit.
    if (!row || row.expiresAt < new Date()) return null;

    return {
      key: row.key,
      requestHash: row.requestHash,
      statusCode: row.statusCode,
      responseBody: row.responseBody,
      userId: row.userId ?? undefined,
      path: row.path,
      expiresAt: row.expiresAt,
    };
  }

  async record(record: IdempotencyRecord): Promise<void> {
    try {
      await this.prisma.client.idempotencyKey.create({
        data: {
          key: record.key,
          requestHash: record.requestHash,
          statusCode: record.statusCode,
          responseBody: (record.responseBody ?? null) as Prisma.InputJsonValue,
          userId: record.userId ?? null,
          path: record.path,
          expiresAt: record.expiresAt,
        },
      });
    } catch (error) {
      // A unique violation here means two identical requests raced. The work
      // has been done and the client has its response, so this must never
      // surface as an error — but it is worth a log line, because a burst of
      // them means a client is retrying far too aggressively.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(`idempotency_race key=${record.key} path=${record.path}`);
        return;
      }

      // Recording is best-effort: the request already succeeded, and failing
      // it now would tell the client the opposite of the truth.
      this.logger.error(
        `idempotency_record_failed key=${record.key}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Called by the nightly prune job. */
  async pruneExpired(now: Date): Promise<number> {
    const result = await this.prisma.client.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }
}
