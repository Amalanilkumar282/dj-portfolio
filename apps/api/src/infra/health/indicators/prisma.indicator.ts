import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Readiness check for the database.
 *
 * A three-second timeout, deliberately short: a readiness probe that hangs is
 * indistinguishable to the platform from one that is slow, and holding the
 * probe open only delays taking a broken instance out of rotation.
 */
@Injectable()
export class PrismaHealthIndicator {
  private static readonly TIMEOUT_MS = 3_000;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const started = Date.now();

    try {
      await Promise.race([
        this.prisma.ping(),
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error('Database ping timed out'));
          }, PrismaHealthIndicator.TIMEOUT_MS),
        ),
      ]);

      return indicator.up({ responseTimeMs: Date.now() - started });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Database unreachable',
        responseTimeMs: Date.now() - started,
      });
    }
  }
}
