import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { EventsRepository } from './events.repository';

/**
 * Hourly reconciliation of `Event.isPast`.
 *
 * `schema.prisma` has documented this column as "maintained by the hourly
 * cron" since Phase 1 — and no such cron existed. The flag therefore kept
 * whatever value the row was created with, so a gig that had already happened
 * stayed in "Upcoming" forever and the archive stayed empty. Nothing surfaced
 * it because, with no real events seeded, both lists were empty either way.
 *
 * The column exists at all because Postgres refuses a non-immutable `now()`
 * in an index predicate, so the cheap "upcoming" partial index has to key off
 * a boolean. That is a storage detail, not a source of truth: anything that
 * needs to-the-minute accuracy (the `when=live` filter, `resolveShowPhase()`)
 * compares timestamps directly instead of trusting this flag.
 *
 * Runs at 12 past the hour rather than on the hour, to stay clear of whatever
 * else the platform schedules at :00.
 */
@Injectable()
export class EventsPastFlagCron {
  private readonly logger = new Logger(EventsPastFlagCron.name);

  constructor(private readonly repository: EventsRepository) {}

  @Cron('12 * * * *', { name: 'events-past-flag' })
  async run(): Promise<void> {
    const result = await this.repository.syncPastFlags(new Date());

    if (!result.ran) {
      this.logger.debug('events_past_flag skipped: lock held by another run');
      return;
    }

    if (result.markedPast > 0 || result.markedUpcoming > 0) {
      this.logger.log(
        `events_past_flag moved ${String(result.markedPast)} to past, ` +
          `${String(result.markedUpcoming)} back to upcoming`,
      );
    }
  }
}
