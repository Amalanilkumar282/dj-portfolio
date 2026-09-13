import { parse as parsePath } from 'node:path';

import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  type HealthCheckResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { CloudinaryHealthIndicator } from './indicators/cloudinary.indicator';
import { PrismaHealthIndicator } from './indicators/prisma.indicator';

/**
 * Liveness and readiness.
 *
 * **The split is load-bearing, not decorative.**
 *
 * `/health` (liveness) deliberately checks NO dependencies. If it did, a
 * database blip would fail the liveness probe, the orchestrator would kill the
 * container, and a recoverable five-second outage would become a crash loop
 * that never recovers because every new container also cannot reach the
 * database.
 *
 * `/health/ready` (readiness) is where dependency checks belong. Failing it
 * takes the instance out of the load balancer without killing it, so it
 * rejoins automatically once the dependency returns.
 *
 * Excluded from the global `/api` prefix (see main.ts) AND marked
 * `VERSION_NEUTRAL`, so the probe path is a plain `/health`. Excluding the
 * prefix alone is not enough — URI versioning still inserts `/v1`, which
 * would leave the endpoint at `/v1/health` and every platform health check
 * pointed at a 404.
 *
 * See docs/05-operations/observability.md
 */
@ApiTags('health')
// `version` goes in the @Controller options: @Version() is a method
// decorator and throws at class level.
@Controller({ path: 'health', version: VERSION_NEUTRAL })
@Public()
@CacheControl(CACHE_POLICIES.noStore)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly cloudinary: CloudinaryHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness. Checks nothing external, by design.' })
  live(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  /**
   * Filesystem root to check.
   *
   * Terminus rejects a POSIX `/` on Windows, so this is derived rather than
   * hardcoded: `C:\` locally, `/` on the Railway container. Hardcoding
   * either one makes readiness fail on the other platform.
   */
  private static readonly diskPath = parsePath(process.cwd()).root;

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness. Checks the database, Cloudinary, memory and disk.' })
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.isHealthy('database'),
      () => this.cloudinary.isHealthy('cloudinary'),
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.9,
          path: HealthController.diskPath,
        }),
    ]);
  }
}
