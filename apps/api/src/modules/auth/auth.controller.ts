import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import type { CurrentUserResponse, LoginResponse, TotpEnrollResponse } from '@dj/contracts';

import { REFRESH_COOKIE } from '../../common/constants';
import { readCookies } from '../../common/cookies';
import { CacheControl, CACHE_POLICIES, CurrentUser, Public } from '../../common/decorators';
import { CsrfGuard } from '../../common/guards';
import { ERROR_CODES } from '../../common/problems';
import type { AppRequest, AuthUser } from '../../common/types';

import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, TotpDisableDto, TotpVerifyDto } from './dto/auth.dto';
import { AuthCookieService } from './services/auth-cookie.service';

/**
 * Auth endpoints.
 *
 * Every response here is `no-store`: an auth response in any cache, at any
 * layer, is a session-hijacking primitive.
 *
 * Rate limits are tighter than the global default. Login gets 10 attempts per
 * 15 minutes per IP, which together with the per-account lockout in
 * `AuthService` covers both credential stuffing and password spraying.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@ApiTags('auth')
@Controller('auth')
@CacheControl(CACHE_POLICIES.noStore)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Sign in with email and password, plus TOTP when enrolled' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const now = new Date();

    const { response: body, refresh } = await this.auth.login(dto, now, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    this.cookies.setRefreshCookie(response, refresh.token, refresh.expiresAt);
    this.cookies.setCsrfCookie(response, refresh.expiresAt);

    return body;
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 900_000 } })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const presented = this.readRefreshCookie(request);
    const now = new Date();

    const result = await this.auth.refresh(presented, now, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    this.cookies.setRefreshCookie(response, result.refresh.token, result.refresh.expiresAt);
    this.cookies.setCsrfCookie(response, result.refresh.expiresAt);

    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Post('logout')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // @Public() because logging out must work even with an expired access
    // token — otherwise a user whose session lapsed cannot clear it.
    const cookies = readCookies(request);

    await this.auth.logout(cookies[REFRESH_COOKIE], new Date(), request.user);
    this.cookies.clearAuthCookies(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.sub, user.email, new Date());
    this.cookies.clearAuthCookies(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The current user, with freshly resolved permissions' })
  async me(@CurrentUser() user: AuthUser): Promise<CurrentUserResponse> {
    // Resolved from the database rather than read off the token, so the admin
    // UI reflects a role change without waiting for the token to expire.
    return this.auth.currentUser(user);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password and revoke every existing session' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, new Date());
    // Including this session: the caller must sign in again with the new
    // password, which is the expected behaviour after a change.
    this.cookies.clearAuthCookies(response);
  }

  @Post('2fa/enroll')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin TOTP enrolment; returns the QR URI and recovery codes' })
  async enrollTotp(@CurrentUser() user: AuthUser): Promise<TotpEnrollResponse> {
    return this.auth.enrollTotp(user);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm enrolment by verifying a code, which enables 2FA' })
  async verifyTotp(@CurrentUser() user: AuthUser, @Body() dto: TotpVerifyDto): Promise<void> {
    await this.auth.verifyTotpEnrollment(user, dto.totp, new Date());
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA; requires the password again' })
  async disableTotp(@CurrentUser() user: AuthUser, @Body() dto: TotpDisableDto): Promise<void> {
    await this.auth.disableTotp(user, dto.password);
  }

  private readRefreshCookie(request: AppRequest): string {
    const cookies = readCookies(request);
    const token = cookies[REFRESH_COOKIE];

    if (!token) {
      throw new UnauthorizedException({
        message: 'No session cookie was presented.',
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
      });
    }

    return token;
  }
}
