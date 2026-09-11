import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';

/**
 * Readiness check for Cloudinary.
 *
 * Reported but NOT fatal to readiness in the sense that matters: Cloudinary
 * being down means new uploads fail, while every already-published page keeps
 * serving from its CDN. Marking the whole instance unready for that would take
 * the site down over a partial degradation.
 *
 * It is still surfaced, because an admin trying to upload deserves a real
 * explanation rather than a silent failure.
 */
@Injectable()
export class CloudinaryHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // Not async: the check is a synchronous config inspection. Declaring it
  // async would promise a network round trip this indicator deliberately does
  // not make — Terminus awaits the result either way.
  isHealthy(key: string): HealthIndicatorResult {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const configured = this.cloudinary.isConfigured();

      // Placeholder credentials are the normal state in development, so this
      // reports degraded rather than down and does not block local work.
      return configured
        ? indicator.up({ configured: true })
        : indicator.up({ configured: false, note: 'credentials not set' });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Cloudinary unreachable',
      });
    }
  }
}
