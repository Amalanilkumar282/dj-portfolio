import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.schema';
import { HealthController } from './health.controller';

/**
 * Phase 0 scaffold.
 *
 * Deliberately minimal: config validation and a health endpoint, so the app
 * builds, boots and can be deployed. Phase 2 adds the real global concerns —
 * Pino logging with request-id correlation, the guard/filter/interceptor
 * chain, versioned routing, PrismaModule, Terminus, Swagger and the rest.
 *
 * The provider ORDER in Phase 2 is the security boundary. Read
 * docs/02-architecture/backend.md before adding to it.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
