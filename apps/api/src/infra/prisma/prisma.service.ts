import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createPrismaClient, getDbContext, type ExtendedPrismaClient } from '@dj/db';

import type { Env } from '../../config/env.schema';

/**
 * The Prisma client, wrapped as a Nest provider.
 *
 * Constructed through `createPrismaClient()` from `@dj/db` rather than
 * `new PrismaClient()`, so every consumer inherits the soft-delete and audit
 * guarantees. There is deliberately no way to obtain a raw client from here —
 * a raw client could hard-delete content.
 *
 * IMPORTANT: repositories inject this. Services and controllers must not,
 * which the `dj/prisma-only-in-repositories` lint rule enforces.
 *
 * See docs/02-architecture/data-model.md
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * The extended client.
   *
   * Exposed as a property rather than by extending `PrismaClient`, because
   * `$extends` returns a structurally different type that cannot be expressed
   * through class inheritance.
   */
  readonly client: ExtendedPrismaClient;

  /** Host and database only. Never the credentials. */
  private readonly target: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('DATABASE_URL', { infer: true });
    this.target = PrismaService.describeTarget(url);

    this.client = createPrismaClient({
      datasourceUrl: url,
      log: ['warn', 'error'],
      // Registered through the factory hook, because `$extends` strips `$on`:
      // a listener attached to `this.client` would silently never fire.
      onQuery: (event) => {
        // The threshold is deliberately low. At this data volume anything
        // over 200ms is a missing index rather than genuine work.
        if (event.duration > 200) {
          this.logger.warn(
            `slow_query duration=${String(event.duration)}ms query=${event.query.slice(0, 200)}`,
          );
        }
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();

    // Logged because "connected to the wrong database" is otherwise invisible
    // until data looks inexplicably stale, and with several environments on
    // one platform that is a genuinely easy mistake to make.
    this.logger.log(`Database connected: ${this.target}`);
  }

  async onModuleDestroy(): Promise<void> {
    // Called by enableShutdownHooks(), so in-flight queries finish before the
    // process exits rather than being cut off mid-transaction.
    await this.client.$disconnect();
  }

  /** Readiness probe for the health module. */
  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  /**
   * Prisma operations issued so far in the current request.
   *
   * Read from the `@dj/db` request context, where `queryCountExtension`
   * accumulates it.
   *
   * **Why not `$on('query')`:** Prisma emits query events through an
   * EventEmitter, so the listener runs outside the caller's
   * AsyncLocalStorage scope and the request context is always empty there —
   * the count could never be attributed to a request. A client extension hook
   * runs synchronously in the calling context, which is the only place the
   * store is live. This cost me an hour; do not "simplify" it back.
   */
  currentQueryCount(): number {
    return getDbContext().queryCount ?? 0;
  }

  /**
   * Reduces a connection string to `host:port/database`.
   *
   * Deliberately strips the user and password: this string ends up in logs,
   * which are drained off-box.
   */
  private static describeTarget(url: string): string {
    try {
      const parsed = new URL(url);
      const pooled = parsed.searchParams.get('pgbouncer') === 'true' ? ' (pooled)' : '';
      return `${parsed.host}${parsed.pathname}${pooled}`;
    } catch {
      return 'unparseable DATABASE_URL';
    }
  }
}
