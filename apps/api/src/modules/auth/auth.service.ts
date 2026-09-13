import { randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type {
  ChangePasswordInput,
  CurrentUserResponse,
  LoginInput,
  LoginResponse,
  TotpEnrollResponse,
} from '@dj/contracts';
import { AuditAction } from '@dj/db';

import { ERROR_CODES } from '../../common/problems';
import type { AuthUser } from '../../common/types';
import type { Env } from '../../config/env.schema';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';

import { AuthRepository, REVOKE_REASONS } from './auth.repository';
import { PasswordService } from './services/password.service';
import { RefreshTokenService, type IssuedRefreshToken } from './services/refresh-token.service';
import { TotpService } from './services/totp.service';

/** Failed attempts before a lockout begins. */
const LOCKOUT_THRESHOLD = 5;
/** Base lockout, doubling per additional failure beyond the threshold. */
const LOCKOUT_BASE_MINUTES = 5;
const LOCKOUT_MAX_MINUTES = 60;

export interface AuthResult {
  response: LoginResponse;
  refresh: IssuedRefreshToken;
}

/**
 * Authentication.
 *
 * Three invariants this file exists to hold, all of them easy to break by
 * accident:
 *
 * 1. **No user enumeration.** An unknown email and a wrong password must be
 *    indistinguishable in body, status *and timing*. The unknown-email path
 *    therefore burns comparable argon2 time via `burnVerifyTime()`. Without
 *    that, a ~1ms versus ~50ms difference reliably reveals which accounts
 *    exist, however identical the JSON.
 *
 * 2. **Two independent lockouts.** Per-account (here) stops password spraying
 *    at one address; per-IP (the throttler) stops credential stuffing across
 *    many. Either alone is defeatable.
 *
 * 3. **Every outcome is audited, including failures.** An interceptor cannot
 *    do this — it never sees a rejected request — which is why this service
 *    writes its own audit rows.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly totp: TotpService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ── login ────────────────────────────────────────────────────────────────

  async login(
    input: LoginInput,
    now: Date,
    context: { ip?: string | undefined; userAgent?: string | undefined } = {},
  ): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email);

    if (!user) {
      // Timing equalisation. See invariant 1 above.
      await this.passwords.burnVerifyTime();
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        metadata: { email: input.email, reason: 'unknown_email' },
      });
      throw this.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        actorId: user.id,
        actorEmail: user.email,
        metadata: { reason: 'locked', lockedUntil: user.lockedUntil.toISOString() },
      });

      // The only case where the reason is disclosed. The account is already
      // known to exist by this point (the caller had the right password at
      // some point to trigger a lockout), and leaving someone with no idea why
      // login fails is a support nightmare.
      throw new UnauthorizedException({
        message: 'This account is temporarily locked. Try again later.',
        code: ERROR_CODES.ACCOUNT_LOCKED,
      });
    }

    const passwordValid = await this.passwords.verify(user.passwordHash, input.password);

    if (!passwordValid) {
      await this.registerFailure(user.id, user.email, user.failedLoginCount, now);
      throw this.invalidCredentials();
    }

    if (!user.isActive) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        actorId: user.id,
        actorEmail: user.email,
        metadata: { reason: 'inactive' },
      });
      throw new UnauthorizedException({
        message: 'This account has been deactivated.',
        code: ERROR_CODES.ACCOUNT_INACTIVE,
      });
    }

    // --- second factor ---------------------------------------------------
    if (user.totpEnabledAt && user.totpSecret) {
      if (!input.totp) {
        // A distinct code so the client can render the TOTP step rather than
        // showing "wrong password" to someone who typed it correctly.
        throw new UnauthorizedException({
          message: 'A verification code is required.',
          code: ERROR_CODES.TOTP_REQUIRED,
        });
      }

      const accepted = await this.verifySecondFactor(
        user.id,
        user.totpSecret,
        user.totpRecoveryCodes,
        input.totp,
      );

      if (!accepted) {
        // Counted towards lockout: without this, TOTP would be brute-forceable
        // at leisure by someone who already has the password.
        await this.registerFailure(user.id, user.email, user.failedLoginCount, now, 'bad_totp');
        throw new UnauthorizedException({
          message: 'That verification code is not valid.',
          code: ERROR_CODES.TOTP_INVALID,
        });
      }
    }

    await this.repository.recordLoginSuccess(user.id, context.ip, now);

    await this.audit.record({
      action: AuditAction.LOGIN,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { newIp: user.lastLoginIp !== (context.ip ?? null) },
    });

    return this.issueSession(
      user.id,
      user.email,
      user.name,
      Boolean(user.totpEnabledAt),
      now,
      context,
    );
  }

  // ── refresh ──────────────────────────────────────────────────────────────

  async refresh(
    presented: string,
    now: Date,
    context: { ip?: string | undefined; userAgent?: string | undefined } = {},
  ): Promise<{ accessToken: string; expiresIn: number; refresh: IssuedRefreshToken }> {
    const { userId, issued } = await this.refreshTokens.rotate(presented, now, context);
    const user = await this.repository.findUserById(userId);

    if (!user?.isActive) throw this.invalidCredentials();

    const { accessToken, expiresIn } = await this.signAccessToken(user.id, user.email);

    await this.audit.record({
      action: AuditAction.TOKEN_REFRESH,
      actorId: user.id,
      actorEmail: user.email,
    });

    return { accessToken, expiresIn, refresh: issued };
  }

  // ── logout ───────────────────────────────────────────────────────────────

  async logout(presented: string | undefined, now: Date, user?: AuthUser): Promise<void> {
    if (presented) await this.refreshTokens.revoke(presented, now);

    if (user) {
      await this.audit.record({
        action: AuditAction.LOGOUT,
        actorId: user.sub,
        actorEmail: user.email,
      });
    }
  }

  async logoutAll(userId: string, email: string, now: Date): Promise<number> {
    const revoked = await this.refreshTokens.revokeAllForUser(
      userId,
      REVOKE_REASONS.LOGOUT_ALL,
      now,
    );

    await this.audit.record({
      action: AuditAction.LOGOUT_ALL,
      actorId: userId,
      actorEmail: email,
      metadata: { revokedCount: revoked },
    });

    return revoked;
  }

  // ── password ─────────────────────────────────────────────────────────────

  async changePassword(user: AuthUser, input: ChangePasswordInput, now: Date): Promise<void> {
    const record = await this.repository.findUserById(user.sub);
    if (!record) throw this.invalidCredentials();

    const currentValid = await this.passwords.verify(record.passwordHash, input.currentPassword);
    if (!currentValid) {
      throw new UnauthorizedException({
        message: 'The current password is not correct.',
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    await this.assertPasswordStrong(input.newPassword, [record.email, record.name]);

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.repository.updatePassword(record.id, passwordHash, now);

    // Everywhere, including the session doing the change. A password change is
    // often a response to a suspected compromise, so leaving other sessions
    // alive would defeat the point.
    const revoked = await this.refreshTokens.revokeAllForUser(
      record.id,
      REVOKE_REASONS.PASSWORD_CHANGE,
      now,
    );

    await this.audit.record({
      action: AuditAction.PASSWORD_CHANGE,
      actorId: record.id,
      actorEmail: record.email,
      metadata: { revokedSessions: revoked },
    });
  }

  // ── two-factor ───────────────────────────────────────────────────────────

  async enrollTotp(user: AuthUser): Promise<TotpEnrollResponse> {
    const record = await this.repository.findUserById(user.sub);
    if (!record) throw this.invalidCredentials();

    const secret = this.totp.generateSecret();
    const { codes, hashes } = await this.totp.generateRecoveryCodes();

    // Stored but NOT yet enabled: `totpEnabledAt` stays null until a code is
    // verified. Enabling on enrolment would lock the user out if they never
    // finished scanning the QR code.
    await this.repository.setTotp(record.id, {
      totpSecret: this.totp.encryptSecret(secret),
      totpEnabledAt: null,
      totpRecoveryCodes: hashes,
    });

    return {
      otpauthUrl: this.totp.buildOtpauthUrl(record.email, secret),
      recoveryCodes: codes,
    };
  }

  async verifyTotpEnrollment(user: AuthUser, token: string, now: Date): Promise<void> {
    const record = await this.repository.findUserById(user.sub);
    if (!record?.totpSecret) {
      throw new BadRequestException({
        message: 'Start two-factor enrolment first.',
        code: ERROR_CODES.TOTP_INVALID,
      });
    }

    const secret = this.totp.decryptSecret(record.totpSecret);
    if (!(await this.totp.verifyToken(secret, token))) {
      throw new UnauthorizedException({
        message: 'That verification code is not valid.',
        code: ERROR_CODES.TOTP_INVALID,
      });
    }

    await this.repository.setTotp(record.id, {
      totpSecret: record.totpSecret,
      totpEnabledAt: now,
      totpRecoveryCodes: record.totpRecoveryCodes,
    });

    await this.audit.record({
      action: AuditAction.TWO_FA_ENABLE,
      actorId: record.id,
      actorEmail: record.email,
    });
  }

  async disableTotp(user: AuthUser, password: string): Promise<void> {
    const record = await this.repository.findUserById(user.sub);
    if (!record) throw this.invalidCredentials();

    // Password re-entry, so a hijacked session cannot quietly remove the
    // second factor and keep long-term access.
    const valid = await this.passwords.verify(record.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'The password is not correct.',
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    await this.repository.setTotp(record.id, {
      totpSecret: null,
      totpEnabledAt: null,
      totpRecoveryCodes: [],
    });

    await this.audit.record({
      action: AuditAction.TWO_FA_DISABLE,
      actorId: record.id,
      actorEmail: record.email,
    });
  }

  // ── me ───────────────────────────────────────────────────────────────────

  async currentUser(user: AuthUser): Promise<CurrentUserResponse> {
    const record = await this.repository.findUserById(user.sub);
    if (!record) throw this.invalidCredentials();

    const { roles, permissions } = await this.rbac.resolveForUser(record.id);

    return {
      id: record.id,
      email: record.email,
      name: record.name,
      avatarUrl: record.avatarUrl,
      roles,
      permissions,
      totpEnabled: Boolean(record.totpEnabledAt),
      lastLoginAt: record.lastLoginAt,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async issueSession(
    userId: string,
    email: string,
    name: string,
    totpEnabled: boolean,
    now: Date,
    context: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<AuthResult> {
    const { accessToken, expiresIn, roles, permissions } = await this.signAccessToken(
      userId,
      email,
    );

    const { issued } = await this.refreshTokens.issue(userId, now, {
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return {
      response: {
        accessToken,
        expiresIn,
        user: { id: userId, email, name, roles, permissions, totpEnabled },
      },
      refresh: issued,
    };
  }

  /**
   * Signs an access token with roles and permissions baked in.
   *
   * Flattening permissions onto the token is what keeps `PermissionsGuard`
   * free of a database round trip. The cost is that a role change takes up to
   * the token lifetime (15 minutes) to apply; `logout-all` forces it sooner
   * when that matters.
   */
  private async signAccessToken(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; expiresIn: number; roles: string[]; permissions: string[] }> {
    const { roles, permissions } = await this.rbac.resolveForUser(userId);
    const ttl = this.config.get('JWT_ACCESS_TTL', { infer: true });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, roles, permissions },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        // `expiresIn` is typed as the `ms` package's StringValue template
        // literal. The env schema validates this as a plain string, so the
        // cast is the seam between the two. `ttlToSeconds` below parses the
        // same value, and would return the 900s default for anything
        // malformed.
        expiresIn: ttl as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    return { accessToken, expiresIn: this.ttlToSeconds(ttl), roles, permissions };
  }

  private async verifySecondFactor(
    userId: string,
    encryptedSecret: string,
    recoveryHashes: string[],
    candidate: string,
  ): Promise<boolean> {
    const secret = this.totp.decryptSecret(encryptedSecret);

    if (await this.totp.verifyToken(secret, candidate.trim())) return true;

    // Fall back to a recovery code, which is single-use.
    const { matched, remaining } = await this.totp.consumeRecoveryCode(recoveryHashes, candidate);

    if (matched) {
      await this.repository.setRecoveryCodes(userId, remaining);
      this.logger.warn(`recovery_code_used userId=${userId} remaining=${String(remaining.length)}`);
      return true;
    }

    return false;
  }

  private async registerFailure(
    userId: string,
    email: string,
    currentCount: number,
    now: Date,
    reason = 'bad_password',
  ): Promise<void> {
    const next = currentCount + 1;

    // Exponential from the threshold, capped: 5 failures gives 5 minutes,
    // 6 gives 10, 7 gives 20, and so on up to an hour.
    let lockedUntil: Date | null = null;
    if (next >= LOCKOUT_THRESHOLD) {
      const minutes = Math.min(
        LOCKOUT_BASE_MINUTES * 2 ** (next - LOCKOUT_THRESHOLD),
        LOCKOUT_MAX_MINUTES,
      );
      lockedUntil = new Date(now.getTime() + minutes * 60_000);
    }

    await this.repository.recordLoginFailure(userId, lockedUntil);

    await this.audit.record({
      action: AuditAction.LOGIN_FAILED,
      actorId: userId,
      actorEmail: email,
      metadata: { reason, attempt: next, lockedUntil: lockedUntil?.toISOString() ?? null },
    });
  }

  private async assertPasswordStrong(password: string, userInputs: string[]): Promise<void> {
    const assessment = await this.passwords.assess(password, userInputs);

    if (!assessment.ok) {
      throw new BadRequestException({
        message: assessment.reason,
        code: ERROR_CODES.PASSWORD_TOO_WEAK,
        errors: [{ pointer: '/newPassword', message: assessment.reason ?? 'Too weak.' }],
      });
    }
  }

  /** Converts a `15m` style TTL into seconds for the client. */
  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;

    const value = Number(match[1]);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

    return value * (multipliers[match[2] ?? 's'] ?? 1);
  }

  private invalidCredentials(): UnauthorizedException {
    // One message for unknown email, wrong password and inactive-after-check.
    // Paired with burnVerifyTime(), this is what closes the enumeration hole.
    return new UnauthorizedException({
      message: 'Email or password is not correct.',
      code: ERROR_CODES.INVALID_CREDENTIALS,
    });
  }

  /** Generates an opaque token for password reset and email confirmation flows. */
  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
