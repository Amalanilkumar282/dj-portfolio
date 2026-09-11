import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditAction } from '@dj/db';

import { ERROR_CODES } from '../../../common/problems';
import type { Env } from '../../../config/env.schema';
import { AuditService } from '../../audit/audit.service';
import { AuthRepository, REVOKE_REASONS } from '../auth.repository';

/** 256 bits of entropy. Opaque, not a JWT — there is nothing to read inside. */
const TOKEN_BYTES = 32;

export interface IssuedRefreshToken {
  /** Plaintext. Goes into the httpOnly cookie and is never stored. */
  token: string;
  familyId: string;
  expiresAt: Date;
}

/**
 * Rotating refresh tokens with reuse detection.
 *
 * The design, and why each part is there:
 *
 * - **Opaque random tokens, not JWTs.** A refresh token needs to be revocable,
 *   and a stateless JWT cannot be revoked before it expires.
 * - **Only the sha256 hash is stored.** A database leak therefore yields no
 *   usable tokens. sha256 rather than argon2 because the input already has 256
 *   bits of entropy, so there is nothing to brute-force and the lookup has to
 *   be a fast indexed read.
 * - **Every refresh rotates.** The old token is revoked and linked to its
 *   replacement via `replacedById`, forming an auditable lineage.
 * - **Reuse revokes the whole family.** If an already-rotated token is
 *   presented, two parties hold it: the legitimate user and whoever stole it.
 *   There is no way to tell which is which, so the correct response is to burn
 *   the entire lineage and force a fresh login. This is the single most
 *   important behaviour in the file.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  /** Hash used for storage and lookup. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Issues a token, starting a new family unless one is supplied.
   *
   * A login starts a family; a rotation continues one.
   */
  async issue(
    userId: string,
    now: Date,
    options: {
      familyId?: string | undefined;
      userAgent?: string | undefined;
      ip?: string | undefined;
    } = {},
  ): Promise<{ issued: IssuedRefreshToken; id: string }> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const familyId = options.familyId ?? randomUUID();

    const ttlDays = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000);

    const id = await this.repository.createRefreshToken({
      userId,
      familyId,
      tokenHash: this.hashToken(token),
      expiresAt,
      userAgent: options.userAgent,
      ip: options.ip,
    });

    return { issued: { token, familyId, expiresAt }, id };
  }

  /**
   * Validates a presented token and rotates it.
   *
   * Throws 401 for every failure mode, with the same message, so a caller
   * cannot distinguish "expired" from "revoked" from "never existed".
   */
  async rotate(
    presented: string,
    now: Date,
    options: { userAgent?: string | undefined; ip?: string | undefined } = {},
  ): Promise<{ userId: string; issued: IssuedRefreshToken }> {
    const record = await this.repository.findRefreshTokenByHash(this.hashToken(presented));

    if (!record) throw this.invalid();

    // --- Reuse detection: the security-critical branch --------------------
    if (record.revokedAt) {
      const revoked = await this.repository.revokeFamily(
        record.familyId,
        REVOKE_REASONS.REUSE_DETECTED,
        now,
      );

      // Alerted on. This means a token was stolen, and it is one of the two
      // conditions in docs/05-operations/observability.md that page a human.
      this.logger.error(
        `token_reuse_detected userId=${record.userId} familyId=${record.familyId} ` +
          `revokedCount=${String(revoked)} previousReason=${record.revokedReason ?? '-'}`,
      );

      await this.audit.record({
        action: AuditAction.TOKEN_REUSE_DETECTED,
        entityType: 'RefreshToken',
        entityId: record.id,
        actorId: record.userId,
        actorEmail: record.user.email,
        metadata: {
          familyId: record.familyId,
          revokedCount: revoked,
          previousReason: record.revokedReason,
        },
      });

      throw new UnauthorizedException({
        message: 'This session is no longer valid. Please sign in again.',
        code: ERROR_CODES.REFRESH_TOKEN_REUSED,
      });
    }

    if (record.expiresAt <= now) throw this.invalid();
    if (!record.user.isActive || record.user.deletedAt) throw this.invalid();

    // A password change invalidates every token issued before it, without
    // needing to touch the token table at change time.
    if (record.createdAt < record.user.passwordChangedAt) throw this.invalid();

    // --- Rotate ----------------------------------------------------------
    const { issued, id } = await this.issue(record.userId, now, {
      familyId: record.familyId,
      userAgent: options.userAgent,
      ip: options.ip,
    });

    await this.repository.markRotated(record.id, id, now);

    return { userId: record.userId, issued };
  }

  /** Revokes a single token, used by logout. */
  async revoke(presented: string, now: Date): Promise<void> {
    const record = await this.repository.findRefreshTokenByHash(this.hashToken(presented));

    // Logout is idempotent: an unknown or already-revoked token is a success,
    // because the caller's goal (not being logged in) is already met.
    if (!record || record.revokedAt) return;

    await this.repository.revokeToken(record.id, REVOKE_REASONS.LOGOUT, now);
  }

  async revokeAllForUser(
    userId: string,
    reason: (typeof REVOKE_REASONS)[keyof typeof REVOKE_REASONS],
    now: Date,
  ): Promise<number> {
    return this.repository.revokeAllForUser(userId, reason, now);
  }

  private invalid(): UnauthorizedException {
    return new UnauthorizedException({
      message: 'This session is no longer valid. Please sign in again.',
      code: ERROR_CODES.REFRESH_TOKEN_INVALID,
    });
  }
}
