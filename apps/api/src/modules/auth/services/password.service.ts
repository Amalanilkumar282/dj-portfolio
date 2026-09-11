import { Injectable, Logger } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import { adjacencyGraphs, dictionary } from '@zxcvbn-ts/language-common';

/**
 * argon2id parameters, at the OWASP recommendation for interactive login.
 *
 * These are duplicated in `packages/db/seed/admin.ts` as `ARGON2_OPTIONS`.
 * **Change them in both places or neither** — a mismatch means the seeded
 * admin password cannot be verified, and the failure presents as "wrong
 * password" rather than as the configuration bug it is.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
export const ARGON2_OPTIONS = {
  algorithm: 2 as const, // argon2id
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

/**
 * Minimum zxcvbn score on its 0-4 scale.
 *
 * 3 means "safely unguessable": it rejects breached passwords and obvious
 * patterns while still allowing a memorable passphrase, which is the whole
 * point of a 12-character minimum with no character-class rules.
 */
const MIN_STRENGTH_SCORE = 3;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  /**
   * The strength checker.
   *
   * Built once at construction because loading the dictionary is not free and
   * this sits in the login path. The common-language pack ships the breached
   * and common-password lists, so the check is entirely local — calling a
   * breach API on every login would put a third party in the authentication
   * path and leak password prefixes to them.
   *
   * `translations` is omitted deliberately: without it the feedback comes back
   * as stable message keys rather than English prose, which is what we want
   * when the admin is eventually localised.
   */
  private readonly zxcvbn = new ZxcvbnFactory({
    dictionary: { ...dictionary },
    graphs: adjacencyGraphs,
  });

  async hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password, ARGON2_OPTIONS);
    } catch (error) {
      // A malformed stored hash must read as "wrong password", never as a
      // 500 — a 500 here would confirm to an attacker that the account exists.
      this.logger.warn(
        `password_verify_failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Burns comparable CPU to a real verify, without one.
   *
   * Called on the unknown-email path. Without it, "no such user" returns in
   * about a millisecond while "wrong password" takes tens of milliseconds of
   * argon2 work, and that gap is a reliable user-enumeration oracle however
   * identical the response bodies are.
   */
  async burnVerifyTime(): Promise<void> {
    await hash('timing-equalisation-only', ARGON2_OPTIONS);
  }

  /**
   * Assesses password strength.
   *
   * Returns feedback rather than throwing, so the caller decides the status
   * code and response shape.
   */
  async assess(
    password: string,
    userInputs: string[] = [],
  ): Promise<{ ok: boolean; score: number; reason?: string }> {
    // Email and name are passed as userInputs, so "felicitous2026" scores as
    // the guessable password it actually is.
    const result = await this.zxcvbn.checkAsync(password, userInputs);

    if (result.score >= MIN_STRENGTH_SCORE) {
      return { ok: true, score: result.score };
    }

    return {
      ok: false,
      score: result.score,
      reason:
        result.feedback.warning ??
        result.feedback.suggestions[0] ??
        'This password is too easy to guess. Try a longer phrase of unrelated words.',
    };
  }
}
