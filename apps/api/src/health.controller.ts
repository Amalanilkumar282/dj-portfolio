import { Controller, Get } from '@nestjs/common';

/**
 * Liveness and readiness.
 *
 * Phase 2 replaces this with Terminus indicators. The split matters and is
 * kept from the start: liveness must NOT check dependencies, or a database
 * blip gets the container killed and restarted in a loop, turning a
 * recoverable outage into a crash loop. Readiness is where dependency checks
 * belong.
 */
@Controller('health')
export class HealthController {
  @Get()
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  ready(): { status: string; checks: Record<string, string> } {
    // Phase 2: database ping, Cloudinary reachability, heap, disk.
    return { status: 'ok', checks: {} };
  }
}
