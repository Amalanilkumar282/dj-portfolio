import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AuditRepository } from './audit.repository';
import { AUDIT_LOG_MAX_ROWS } from './audit.service';

/**
 * Nightly safety net for the audit table's row cap.
 *
 * `AuditService.record()` already trims the table back down to
 * `AUDIT_LOG_MAX_ROWS` after every single insert — that per-write trim is
 * the actual enforcement, and it's what keeps the table small in the first
 * place. This cron exists only for the cases that path can't cover: a crash
 * between the insert and its trim, a future write path that bypasses
 * `AuditService.record`, or a bulk import — any of which could otherwise
 * leave the table over cap indefinitely with nothing to ever notice.
 *
 * Advisory-locked the same way `MediaOrphanSweepCron` is, so a second
 * instance skips rather than racing; see `AuditRepository.trimToLatestLocked`.
 * Runs at 03:40 IST (22:10 UTC), the same low-traffic window the media sweep
 * uses.
 */
@Injectable()
export class AuditRetentionCron {
  private readonly logger = new Logger(AuditRetentionCron.name);

  constructor(private readonly repository: AuditRepository) {}

  @Cron('10 22 * * *', { name: 'audit-log-retention' })
  async run(): Promise<void> {
    const result = await this.repository.trimToLatestLocked(AUDIT_LOG_MAX_ROWS);

    if (!result.ran) {
      this.logger.debug('audit_log_retention skipped: lock held by another run');
      return;
    }

    if (result.deleted > 0) {
      // Non-zero here means the per-write trim fell behind at some point
      // since the last run — worth knowing about, not just silently fixing.
      this.logger.log(
        `audit_log_retention caught up ${String(result.deleted)} row(s) the per-write trim missed`,
      );
    }

    // Deliberately not itself audited: a table auditing its own cap
    // enforcement would just add to what needs capping.
  }
}
