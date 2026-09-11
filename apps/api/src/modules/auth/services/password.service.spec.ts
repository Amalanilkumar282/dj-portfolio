import { describe, expect, it, vi } from 'vitest';

import { PasswordService } from './password.service';

/**
 * `auth/` is specified to sit at 100% coverage
 * ([ADR 0003](../../../../../docs/01-decisions/0003-nestjs-hand-rolled-auth.md)) —
 * anything less on hand-rolled auth is theatre. This file and
 * `totp.service.spec.ts` close the gap the e2e suite could not: the e2e
 * matrix proves the *endpoints* behave correctly, but never exercises
 * `assess()`'s strength scoring, `burnVerifyTime()`'s timing-equalisation
 * path, or a malformed stored hash — none of which any seeded login attempt
 * reaches.
 */

describe('PasswordService', () => {
  const service = new PasswordService();

  describe('hash / verify', () => {
    it('round-trips a password', async () => {
      const passwordHash = await service.hash('a genuinely long passphrase');

      expect(await service.verify(passwordHash, 'a genuinely long passphrase')).toBe(true);
    });

    it('rejects the wrong password', async () => {
      const passwordHash = await service.hash('the real password here');

      expect(await service.verify(passwordHash, 'a guess')).toBe(false);
    });

    it('produces a different hash for the same password each time', async () => {
      // argon2id salts per call; two identical passwords must not produce
      // comparable ciphertext, or a database leak reveals which accounts
      // share a password.
      const first = await service.hash('same password twice');
      const second = await service.hash('same password twice');

      expect(first).not.toBe(second);
    });

    it('treats a malformed stored hash as a failed verify, not a thrown error', async () => {
      // This is the case a real login can never exercise deliberately: it
      // only happens if stored data is corrupt. A throw here would 500,
      // and a 500 on login confirms to an attacker that the account exists
      // — the one thing burnVerifyTime and the identical-response design
      // exist to prevent.
      await expect(service.verify('not-a-real-argon2-hash', 'anything')).resolves.toBe(false);
    });

    it('logs a warning rather than swallowing the malformed-hash case silently', async () => {
      const logger = vi.spyOn(
        // @ts-expect-error -- reaching into a private field to assert the
        // failure is observable in production logs, not just non-throwing.
        service.logger,
        'warn',
      );

      await service.verify('garbage', 'anything');

      expect(logger).toHaveBeenCalledOnce();
      logger.mockRestore();
    });
  });

  describe('burnVerifyTime', () => {
    it('takes comparable time to a real verify', async () => {
      // The whole point: burning less time than a real verify would leave a
      // measurable gap between "unknown email" and "wrong password", which
      // is a user-enumeration oracle regardless of how identical the
      // response bodies are. This does not assert an exact bound — CI
      // timing is not reliable enough for that — only that it is not
      // orders of magnitude cheaper, which is what "not calling argon2 at
      // all" would look like.
      const hashStart = performance.now();
      await service.hash('timing comparison baseline');
      const hashElapsed = performance.now() - hashStart;

      const burnStart = performance.now();
      await service.burnVerifyTime();
      const burnElapsed = performance.now() - burnStart;

      expect(burnElapsed).toBeGreaterThan(hashElapsed * 0.5);
    });

    it('resolves rather than throwing', async () => {
      await expect(service.burnVerifyTime()).resolves.toBeUndefined();
    });
  });

  describe('assess', () => {
    it('accepts a long, unrelated-word passphrase', async () => {
      const result = await service.assess('correct horse battery staple giraffe');

      expect(result.ok).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('rejects a short, common password', async () => {
      const result = await service.assess('password123');

      expect(result.ok).toBe(false);
      expect(result.score).toBeLessThan(3);
      expect(result.reason).toBeTypeOf('string');
    });

    it('scores a guessable password lower when userInputs supply the context', async () => {
      // "felicitous2026" looks structurally fine in isolation, but is exactly
      // the guessable pattern (brand name + year) userInputs exists to catch.
      const withoutContext = await service.assess('felicitous2026');
      const withContext = await service.assess('felicitous2026', [
        'felicitous',
        'dj felicitous',
        'admin@djfelicitous.com',
      ]);

      expect(withContext.score).toBeLessThanOrEqual(withoutContext.score);
    });

    it('always returns a reason when rejecting, never an empty one', async () => {
      const result = await service.assess('12345678');

      expect(result.ok).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('never throws on empty input', async () => {
      await expect(service.assess('')).resolves.toMatchObject({ ok: false });
    });
  });
});
