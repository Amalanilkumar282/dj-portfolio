import 'reflect-metadata';

import { Logger } from '@nestjs/common';
// Imported as a value, not `import type`: Nest resolves providers by class
// reference, so `app.get('ConfigService')` with a string token throws
// UnknownElementException.
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

/**
 * Phase 0 scaffold bootstrap.
 *
 * Phase 2 adds: Pino logger, trust proxy, helmet, compression, cookie-parser,
 * global prefix + URI versioning, CORS with credentials, the global
 * ValidationPipe, a 256kb body limit, graceful shutdown and Swagger.
 *
 * The provider order in app.module.ts is the security boundary — read
 * docs/02-architecture/backend.md before adding to it.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(`API listening on http://localhost:${String(port)}`);
}

void bootstrap();
