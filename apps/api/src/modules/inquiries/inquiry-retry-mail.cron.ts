import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';

import { InquiriesRepository } from './inquiries.repository';
import { INQUIRY_CREATED, type InquiryCreatedEvent } from './inquiries.service';

const LOOKBACK_HOURS = 24;

/**
 * Re-fires the mail flow for any inquiry still missing `notifiedAt`.
 *
 * A dropped notification costs a real booking, so this retry is not
 * optional — see docs/02-architecture/backend.md. Runs at 04:00 IST
 * (22:30 UTC), after the notification window from the day's enquiries has
 * had a chance to fail and settle.
 */
@Injectable()
export class InquiryRetryMailCron {
  private readonly logger = new Logger(InquiryRetryMailCron.name);

  constructor(
    private readonly repository: InquiriesRepository,
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
  ) {}

  @Cron('30 22 * * *', { name: 'retry-failed-mail' })
  async run(): Promise<void> {
    const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const pending = await this.repository.listPendingNotification(cutoff);

    if (pending.length === 0) return;

    this.logger.log(`retry_failed_mail retrying=${String(pending.length)}`);

    for (const inquiry of pending) {
      this.events.emit(INQUIRY_CREATED, { inquiryId: inquiry.id } satisfies InquiryCreatedEvent);
    }
  }
}
