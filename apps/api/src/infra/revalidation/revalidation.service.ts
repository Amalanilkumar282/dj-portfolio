import { createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import type { ContentChangedEvent, RevalidatePayload } from '@dj/contracts';

import type { Env } from '../../config/env.schema';

import { resolveTags } from './tag-map';

/** The domain event name. Emitted by every content service on mutation. */
export const CONTENT_CHANGED = 'content.changed';

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Tells the web app which cached data is now stale.
 *
 * **This is the most important integration in the system.** The artist edits a
 * persona in admin and the public page must update within seconds, with no
 * redeploy. If this breaks, the project has failed its central requirement —
 * so the failure modes matter as much as the happy path:
 *
 * - **Never blocks the write.** The artist's save must not fail because Vercel
 *   hiccuped. Failures are retried and then logged, never propagated.
 * - **Signed with HMAC over `timestamp.body`.** A static bearer token would be
 *   replayable forever; the timestamp window makes a captured request useless
 *   after five minutes.
 * - **Backstopped by a weekly `revalidate-all` cron.** Webhooks fail, and a
 *   site quietly serving month-old content is worse than one that refreshes
 *   slowly.
 *
 * Services emit `content.changed` rather than calling this directly, so
 * revalidation stays decoupled from business logic and a service needs no
 * knowledge of caching at all.
 *
 * See docs/02-architecture/caching-and-revalidation.md
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Handles a content change.
   *
   * Registered via `@OnEvent`, so it runs after the emitting transaction has
   * committed — revalidating before commit would race the web app into
   * re-reading the old row.
   */
  @OnEvent(CONTENT_CHANGED)
  async onContentChanged(event: ContentChangedEvent): Promise<void> {
    const tags = resolveTags(event);

    this.logger.log(
      `content_changed entity=${event.entity} slug=${event.slug ?? '-'} ` +
        `action=${event.action} tags=${tags.join(',')}`,
    );

    await this.revalidate({ tags });
  }

  /**
   * Posts the signed webhook, retrying with exponential backoff.
   *
   * Returns whether it succeeded, so the caller can surface "Live in ~5s" in
   * the admin UI — that round trip is user-visible trust, and an artist who
   * cannot tell whether a change went live will simply publish again.
   */
  async revalidate(payload: RevalidatePayload): Promise<boolean> {
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const secret = this.config.get('REVALIDATE_SECRET', { infer: true });
    const url = new URL('/api/revalidate', this.config.get('WEB_BASE_URL', { infer: true }));

    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-djf-timestamp': timestamp,
            'x-djf-signature': signature,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) return true;

        // A 401 is a REVALIDATE_SECRET mismatch between the API and the web
        // app, and it is by far the most common cause of "I published but
        // nothing changed". Named explicitly so the log says so.
        if (response.status === 401) {
          this.logger.error(
            'revalidate_failed status=401 — REVALIDATE_SECRET does not match apps/web. ' +
              'See docs/05-operations/env-vars.md',
          );
          return false;
        }

        this.logger.warn(
          `revalidate_retry attempt=${String(attempt)} status=${String(response.status)}`,
        );
      } catch (error) {
        this.logger.warn(
          `revalidate_retry attempt=${String(attempt)} ` +
            `error=${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (attempt < MAX_ATTEMPTS) {
        // 250ms, 500ms. Short, because this runs inside a request-adjacent
        // handler and the weekly cron is the real safety net.
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }

    this.logger.error(
      `revalidate_failed tags=${payload.tags.join(',')} after ${String(MAX_ATTEMPTS)} attempts`,
    );

    return false;
  }
}
