import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import type { Env } from '../../config/env.schema';

export interface SendMailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Resend wrapper.
 *
 * Mirrors `CloudinaryService`'s graceful-degradation shape: a placeholder
 * `RESEND_API_KEY` is the normal state until real credentials exist, so
 * `send()` logs and reports failure rather than throwing — a booking
 * inquiry must still write its row and return 201 even when mail cannot go
 * out. The caller (`InquiriesService`'s `@OnEvent` handler) is what retries,
 * via `mailFailureCount` and the `retry-failed-mail` cron.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private client: Resend | null = null;
  private configured = false;
  private from = '';

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    this.from = this.config.get('MAIL_FROM', { infer: true });

    // Mirrors CloudinaryService's placeholder detection: local/test envs use
    // either the documented "replace-me" or "re_test".
    this.configured = !/replace.?me|^re_test$/i.test(apiKey);

    if (this.configured) {
      this.client = new Resend(apiKey);
      this.logger.log('Resend configured');
    } else {
      this.logger.warn('RESEND_API_KEY is a placeholder; outbound mail will be skipped, not sent');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Sends, or — when unconfigured — logs what would have been sent and
   * returns `false`. Never throws: a mail failure must not fail the request
   * that triggered it.
   */
  async send(input: SendMailInput): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(`mail_skipped_unconfigured to=${JSON.stringify(input.to)} subject="${input.subject}"`);
      return false;
    }

    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });

      if (result.error) {
        this.logger.error(`mail_send_failed to=${JSON.stringify(input.to)} error=${result.error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `mail_send_failed to=${JSON.stringify(input.to)}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}
