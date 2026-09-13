import type { ConfigService } from '@nestjs/config';
import { generate as generateOtp } from 'otplib';
import { describe, expect, it } from 'vitest';

import type { Env } from '../../../config/env.schema';

import { TotpService } from './totp.service';

/**
 * `auth/` is specified to sit at 100% coverage — see the note at the top of
 * `password.service.spec.ts`. The e2e suite never enrols real TOTP, so
 * secret encryption, recovery-code hashing and the epoch-tolerance window
 * have no coverage without this file.
 */

/** A 64-hex-char key, matching the env schema's `.length(64)` validation. */
const TEST_KEY = '0123456789abcdef'.repeat(4);

function makeService(key = TEST_KEY): TotpService {
  // Only `get('TOTP_ENCRYPTION_KEY')` is ever called, so the fake stands in
  // for the one method TotpService actually uses.
  const config = { get: () => key } as unknown as ConfigService<Env, true>;

  return new TotpService(config);
}

describe('TotpService', () => {
  const service = makeService();

  describe('generateSecret / buildOtpauthUrl', () => {
    it('generates a usable base32 secret', () => {
      const secret = service.generateSecret();

      expect(secret).toMatch(/^[A-Z2-7]+=*$/);
      expect(secret.length).toBeGreaterThan(0);
    });

    it('generates a different secret each call', () => {
      expect(service.generateSecret()).not.toBe(service.generateSecret());
    });

    it('builds an otpauth:// URI carrying the issuer and the account email', () => {
      const url = service.buildOtpauthUrl('admin@djfelicitous.com', service.generateSecret());

      expect(url).toMatch(/^otpauth:\/\/totp\//);
      expect(decodeURIComponent(url)).toContain('DJ Felicitous Admin');
      expect(decodeURIComponent(url)).toContain('admin@djfelicitous.com');
    });
  });

  describe('verifyToken', () => {
    it('accepts the code currently valid for the secret', async () => {
      const secret = service.generateSecret();
      const code = await generateOtp({ secret });

      expect(await service.verifyToken(secret, code)).toBe(true);
    });

    it('rejects a code for a different secret', async () => {
      const secret = service.generateSecret();
      const wrongSecret = service.generateSecret();
      const code = await generateOtp({ secret: wrongSecret });

      expect(await service.verifyToken(secret, code)).toBe(false);
    });

    it('rejects a structurally invalid code without throwing', async () => {
      const secret = service.generateSecret();

      await expect(service.verifyToken(secret, 'not-six-digits')).resolves.toBe(false);
    });

    it('rejects an empty code without throwing', async () => {
      const secret = service.generateSecret();

      await expect(service.verifyToken(secret, '')).resolves.toBe(false);
    });
  });

  describe('encryptSecret / decryptSecret', () => {
    it('round-trips a secret', () => {
      const secret = service.generateSecret();
      const encrypted = service.encryptSecret(secret);

      expect(service.decryptSecret(encrypted)).toBe(secret);
    });

    it('never stores the plaintext secret in the encrypted output', () => {
      // The whole point of encrypting at rest: a database read alone must
      // not yield a working second factor.
      const secret = service.generateSecret();
      const encrypted = service.encryptSecret(secret);

      expect(encrypted).not.toContain(secret);
    });

    it('produces a different ciphertext for the same secret each time', () => {
      // A fresh random IV per call, so two admins who happened to generate
      // the same secret (astronomically unlikely, but the property should
      // hold regardless) would not be distinguishable from stored ciphertext.
      const secret = service.generateSecret();

      expect(service.encryptSecret(secret)).not.toBe(service.encryptSecret(secret));
    });

    it('rejects a tampered ciphertext rather than returning garbage', () => {
      const secret = service.generateSecret();
      const [iv = '', tag = '', data = ''] = service.encryptSecret(secret).split(':');

      // Flip a hex character in the ciphertext body.
      const tampered = `${iv}:${tag}:${data.replace(/^./, (c) => (c === '0' ? '1' : '0'))}`;

      // GCM's auth tag must fail to verify, and `final()` must throw rather
      // than silently returning corrupted plaintext.
      expect(() => service.decryptSecret(tampered)).toThrow();
    });

    it('rejects a malformed encrypted string', () => {
      expect(() => service.decryptSecret('not-the-right-format')).toThrow(
        'Malformed encrypted TOTP secret.',
      );
    });

    it('rejects an auth tag of the wrong length', () => {
      expect(() => service.decryptSecret('aabbcc:aabbcc:aabbcc')).toThrow('bad auth tag length');
    });

    it('cannot decrypt with a different key', () => {
      const secret = service.generateSecret();
      const encrypted = service.encryptSecret(secret);

      const otherService = makeService('f'.repeat(64));

      expect(() => otherService.decryptSecret(encrypted)).toThrow();
    });
  });

  describe('recovery codes', () => {
    it('generates the documented count of codes, all from the safe alphabet', async () => {
      const { codes, hashes } = await service.generateRecoveryCodes();

      expect(codes).toHaveLength(10);
      expect(hashes).toHaveLength(10);
      // Crockford base32 minus 0/O/1/I/L — read aloud down a phone line.
      for (const code of codes) {
        expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]+$/);
      }
    });

    it('generates codes that are all distinct', async () => {
      const { codes } = await service.generateRecoveryCodes();

      expect(new Set(codes).size).toBe(codes.length);
    });

    it('stores only argon2 hashes, never the plaintext', async () => {
      const { codes, hashes } = await service.generateRecoveryCodes();

      for (const hash of hashes) {
        expect(hash).toMatch(/^\$argon2/);
        expect(codes).not.toContain(hash);
      }
    });

    it('consumes a matching code and removes only that one hash', async () => {
      const { codes, hashes } = await service.generateRecoveryCodes();
      const target = codes[3]!;

      const result = await service.consumeRecoveryCode(hashes, target);

      expect(result.matched).toBe(true);
      expect(result.remaining).toHaveLength(hashes.length - 1);
    });

    it('is case- and formatting-insensitive on the candidate', async () => {
      const { codes, hashes } = await service.generateRecoveryCodes();
      const target = codes[0]!;
      const decorated = ` ${target.toLowerCase().replace(/(.{5})/, '$1-')} `;

      const result = await service.consumeRecoveryCode(hashes, decorated);

      expect(result.matched).toBe(true);
    });

    it('does not match a code from a different set', async () => {
      const { hashes } = await service.generateRecoveryCodes();
      const { codes: otherCodes } = await service.generateRecoveryCodes();

      const result = await service.consumeRecoveryCode(hashes, otherCodes[0]!);

      expect(result.matched).toBe(false);
      expect(result.remaining).toEqual(hashes);
    });

    it('a code can only be used once — consuming it again fails', async () => {
      const { codes, hashes } = await service.generateRecoveryCodes();
      const target = codes[0]!;

      const first = await service.consumeRecoveryCode(hashes, target);
      expect(first.matched).toBe(true);

      const second = await service.consumeRecoveryCode(first.remaining, target);
      expect(second.matched).toBe(false);
    });

    it('rejects garbage input without throwing', async () => {
      const { hashes } = await service.generateRecoveryCodes();

      await expect(
        service.consumeRecoveryCode(hashes, 'not-a-valid-code-at-all'),
      ).resolves.toMatchObject({ matched: false });
    });
  });
});
