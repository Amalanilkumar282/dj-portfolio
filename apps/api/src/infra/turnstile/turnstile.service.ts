import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare Turnstile verification, guarding the public inquiry and
 * newsletter forms.
 *
 * Mirrors `CloudinaryService`/`MailService`'s graceful-degradation shape: a
 * placeholder `TURNSTILE_SECRET_KEY` is the normal state until a real one
 * exists, so verification is **skipped** (not failed) in that case, logged
 * loudly so it is never mistaken for "working". Once configured, a failed
 * verification genuinely rejects the submission — that is the entire point
 * of the check.
 */
@Injectable()
export class TurnstileService implements OnModuleInit {
  private readonly logger = new Logger(TurnstileService.name);
  private secretKey = '';
  private configured = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    this.secretKey = this.config.get('TURNSTILE_SECRET_KEY', { infer: true });
    // Mirrors CloudinaryService's placeholder detection: local/test envs use
    // either the documented "replace-me" or the literal "test".
    this.configured = !/replace.?me|^test$/i.test(this.secretKey);

    if (!this.configured) {
      this.logger.warn('TURNSTILE_SECRET_KEY is a placeholder; verification is skipped, not enforced');
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async verify(token: string, remoteIp: string | undefined): Promise<boolean> {
    if (!this.configured) return true;

    try {
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          secret: this.secretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
      });

      const result = (await response.json()) as { success: boolean };
      return result.success;
    } catch (error) {
      this.logger.error(
        'turnstile_verify_failed',
        error instanceof Error ? error.stack : String(error),
      );
      // A network error talking to Cloudflare is not evidence the submitter
      // is a bot — fail open rather than blocking a real booking enquiry
      // over a third-party outage.
      return true;
    }
  }
}
