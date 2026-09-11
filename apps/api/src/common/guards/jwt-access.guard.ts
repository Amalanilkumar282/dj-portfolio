import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { Env } from '../../config/env.schema';
import { IS_PUBLIC_KEY } from '../constants';
import { ERROR_CODES } from '../problems';
import { attachActorToContext } from '../services/actor-context';
import { RequestContextService } from '../services/request-context.service';
import type { AppRequest, AuthUser } from '../types';

/**
 * Verifies the access token and attaches the principal.
 *
 * **Denies by default.** Registered globally, so every route requires a valid
 * token unless it carries `@Public()`. That direction is the whole point:
 * forgetting the decorator yields a locked endpoint, which is noticed
 * immediately, whereas a guard-per-route scheme fails open when someone
 * forgets `@UseGuards` — and nobody notices until it is exploited.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly requestContext: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AppRequest>();

    // Even on a public route, decode an Authorization header when one is
    // present. Draft-mode preview and analytics attribution both benefit from
    // knowing who is looking, and a malformed token here must not 401 a page
    // that does not require auth.
    if (isPublic) {
      await this.tryAttach(request);
      return true;
    }

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Authentication required.',
        code: ERROR_CODES.AUTH_REQUIRED,
      });
    }

    const user = await this.verify(token);
    request.user = user;
    attachActorToContext(this.requestContext, user);

    return true;
  }

  private async tryAttach(request: AppRequest): Promise<void> {
    const token = this.extractToken(request);
    if (!token) return;

    try {
      const user = await this.verify(token);
      request.user = user;
      attachActorToContext(this.requestContext, user);
    } catch {
      // Deliberately swallowed: the route is public.
    }
  }

  private extractToken(request: AppRequest): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;

    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }

  private async verify(token: string): Promise<AuthUser> {
    try {
      return await this.jwt.verifyAsync<AuthUser>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      // The reason is never disclosed — expired, malformed and wrong-signature
      // all look identical to a caller, which denies an attacker an oracle.
      // The code still distinguishes *which* token failed, because the client
      // needs that to decide between refreshing and re-authenticating.
      throw new UnauthorizedException({
        message: 'The access token is invalid or has expired.',
        code: ERROR_CODES.ACCESS_TOKEN_INVALID,
      });
    }
  }
}
