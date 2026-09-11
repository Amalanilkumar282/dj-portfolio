import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';

/** Why a refresh token was revoked. Values are stored verbatim for forensics. */
export const REVOKE_REASONS = {
  ROTATED: 'ROTATED',
  REUSE_DETECTED: 'REUSE_DETECTED',
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  ADMIN_REVOKE: 'ADMIN_REVOKE',
} as const;

export type RevokeReason = (typeof REVOKE_REASONS)[keyof typeof REVOKE_REASONS];

export interface CreateRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | undefined;
  ip?: string | undefined;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── users ────────────────────────────────────────────────────────────────

  /**
   * Looks up a user for login.
   *
   * Includes soft-deleted users deliberately excluded by the extension: a
   * deleted account must not be able to log in, and the soft-delete extension
   * already filters `findUnique`, so this returns null for them.
   */
  async findUserByEmail(email: string) {
    return this.prisma.client.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  async recordLoginSuccess(userId: string, ip: string | undefined, now: Date): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: now,
        lastLoginIp: ip ?? null,
        // Cleared on success, so a legitimate user is not locked out by
        // earlier typos.
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * Increments the failure counter and applies a lockout.
   *
   * Returns the new count so the caller can log how close the account is to
   * lockout without a second read.
   */
  async recordLoginFailure(userId: string, lockedUntil: Date | null): Promise<number> {
    const updated = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: { increment: 1 },
        lockedUntil,
      },
      select: { failedLoginCount: true },
    });

    return updated.failedLoginCount;
  }

  async updatePassword(userId: string, passwordHash: string, now: Date): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        // Bumping this invalidates every access token issued earlier without
        // a table scan — see AuthService.verifyTokenFreshness.
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  async setTotp(
    userId: string,
    data: { totpSecret: string | null; totpEnabledAt: Date | null; totpRecoveryCodes: string[] },
  ): Promise<void> {
    await this.prisma.client.user.update({ where: { id: userId }, data });
  }

  async setRecoveryCodes(userId: string, hashes: string[]): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { totpRecoveryCodes: hashes },
    });
  }

  // ── refresh tokens ───────────────────────────────────────────────────────

  async createRefreshToken(input: CreateRefreshToken): Promise<string> {
    const created = await this.prisma.client.refreshToken.create({
      data: {
        userId: input.userId,
        familyId: input.familyId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      },
      select: { id: true },
    });

    return created.id;
  }

  /** Looks a token up by its sha256 hash. The plaintext is never stored. */
  async findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async markRotated(id: string, replacedById: string, now: Date): Promise<void> {
    await this.prisma.client.refreshToken.update({
      where: { id },
      data: { revokedAt: now, revokedReason: REVOKE_REASONS.ROTATED, replacedById },
    });
  }

  /**
   * Revokes every live token in a rotation family.
   *
   * This is the stolen-token response: presenting an already-rotated token
   * means two parties hold it, so the whole lineage is burned and both are
   * forced to log in again.
   */
  async revokeFamily(familyId: string, reason: RevokeReason, now: Date): Promise<number> {
    const result = await this.prisma.client.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });

    return result.count;
  }

  async revokeToken(id: string, reason: RevokeReason, now: Date): Promise<void> {
    await this.prisma.client.refreshToken.update({
      where: { id },
      data: { revokedAt: now, revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: RevokeReason, now: Date): Promise<number> {
    const result = await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });

    return result.count;
  }

  /** Called by the nightly prune job. */
  async pruneExpired(before: Date): Promise<number> {
    const result = await this.prisma.client.refreshToken.deleteMany({
      where: { expiresAt: { lt: before } },
    });

    return result.count;
  }
}
