import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify as argonVerify } from '@node-rs/argon2';
import { generateSecret, generateURI, verify as verifyOtp } from 'otplib';

import type { Env } from '../../../config/env.schema';

import { ARGON2_OPTIONS } from './password.service';

/** AES-256-GCM: 12-byte nonce is the recommended size, 16-byte auth tag. */
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Accepted clock skew, in seconds.
 *
 * One 30-second step either side tolerates a phone whose clock has drifted.
 * Wider would meaningfully extend the guessing window for a six-digit code,
 * which is only 10^6 possibilities to begin with.
 */
const EPOCH_TOLERANCE_SECONDS = 30;

const RECOVERY_CODE_COUNT = 10;

/**
 * Alphabet for recovery codes: Crockford base32 minus the ambiguous glyphs.
 *
 * No 0/O or 1/I/L, because these get read aloud down a phone line and copied
 * off a screen under stress.
 */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_CODE_LENGTH = 10;

@Injectable()
export class TotpService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  /** A new base32 secret, to be encrypted before storage. */
  generateSecret(): string {
    return generateSecret();
  }

  /** The otpauth:// URI the admin renders as a QR code. */
  buildOtpauthUrl(email: string, secret: string): string {
    return generateURI({ issuer: 'DJ Felicitous Admin', label: email, secret });
  }

  async verifyToken(secret: string, token: string): Promise<boolean> {
    try {
      const result = await verifyOtp({
        secret,
        token,
        epochTolerance: EPOCH_TOLERANCE_SECONDS,
      });

      return result.valid;
    } catch {
      // otplib throws on malformed input. A bad code is a normal outcome, not
      // an error condition.
      return false;
    }
  }

  /**
   * Encrypts a TOTP secret at rest with AES-256-GCM.
   *
   * A database read alone must not yield a working second factor — otherwise a
   * read-only leak defeats 2FA entirely, which rather defeats the purpose of
   * having it.
   *
   * The key lives in `TOTP_ENCRYPTION_KEY` and is **not** safely rotatable
   * without re-encrypting every stored secret. Read
   * docs/05-operations/runbooks/secret-rotation.md before touching it: a naive
   * rotation locks every enrolled admin out of their own account.
   *
   * Format: `iv:authTag:ciphertext`, all hex.
   */
  encryptSecret(secret: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);

    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
  }

  decryptSecret(encrypted: string): string {
    const [ivHex, tagHex, dataHex] = encrypted.split(':');

    if (!ivHex || !tagHex || !dataHex) {
      throw new Error('Malformed encrypted TOTP secret.');
    }

    const authTag = Buffer.from(tagHex, 'hex');
    if (authTag.length !== TAG_LENGTH) {
      throw new Error('Malformed encrypted TOTP secret: bad auth tag length.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(ivHex, 'hex'),
    );

    // Must be set before final(), or GCM cannot authenticate and final()
    // throws rather than returning garbage — which is the desired behaviour.
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
      'utf8',
    );
  }

  /**
   * Generates recovery codes and their hashes.
   *
   * The plaintext is returned to show **once**; only argon2 hashes are stored.
   * So losing the phone is recoverable, while a database read is still not
   * enough to bypass the second factor.
   */
  async generateRecoveryCodes(): Promise<{ codes: string[]; hashes: string[] }> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => this.randomRecoveryCode());
    const hashes = await Promise.all(codes.map((code) => hash(code, ARGON2_OPTIONS)));

    return { codes, hashes };
  }

  /**
   * Consumes a recovery code.
   *
   * Returns the remaining hashes with the matched one removed, so the caller
   * can persist them: a recovery code is single-use by definition, and
   * leaving it valid would turn ten codes into ten permanent bypasses.
   */
  async consumeRecoveryCode(
    hashes: string[],
    candidate: string,
  ): Promise<{ matched: boolean; remaining: string[] }> {
    const normalised = candidate.trim().toUpperCase().replace(/[\s-]/g, '');

    for (const [index, stored] of hashes.entries()) {
      let matched = false;
      try {
        matched = await argonVerify(stored, normalised, ARGON2_OPTIONS);
      } catch {
        matched = false;
      }

      if (matched) {
        return { matched: true, remaining: hashes.filter((_, i) => i !== index) };
      }
    }

    return { matched: false, remaining: hashes };
  }

  private randomRecoveryCode(): string {
    // Rejection-free selection would bias towards the start of the alphabet
    // with a naive modulo, so bytes are drawn generously and mapped by index
    // into a 30-character alphabet that divides 240 evenly.
    const bytes = randomBytes(RECOVERY_CODE_LENGTH * 2);
    let code = '';

    for (let i = 0; code.length < RECOVERY_CODE_LENGTH; i += 1) {
      const byte = bytes[i % bytes.length] ?? 0;
      if (byte >= 240) continue; // discard the biased tail
      code += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length] ?? '';
    }

    return code;
  }

  private encryptionKey(): Buffer {
    // Annotated rather than inlined: ConfigService.get widens enough under
    // `infer` to make Buffer.from pick the ArrayBuffer overload, which fails
    // to compile in a way that reads as a Buffer problem rather than a typing
    // one.
    const hex: string = this.config.get('TOTP_ENCRYPTION_KEY', { infer: true });

    // Validated as exactly 64 hex characters by the env schema, so this
    // always yields the 32 bytes AES-256 requires.
    return Buffer.from(hex, 'hex');
  }
}
