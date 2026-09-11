import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { RbacModule } from '../rbac/rbac.module';

import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { PasswordService } from './services/password.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { TotpService } from './services/totp.service';

/**
 * Global, because JwtAccessGuard is registered as a global guard and needs
 * JwtService. Registering JwtModule here and exporting it is what lets the
 * guard resolve without every module importing auth.
 *
 * JwtModule is registered WITHOUT a default secret on purpose: access and
 * refresh tokens use different secrets, so each sign and verify call passes
 * its own explicitly. A default would make it far too easy to sign a refresh
 * token with the access secret by omission.
 */
@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    AuthCookieService,
    PasswordService,
    RefreshTokenService,
    TotpService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
