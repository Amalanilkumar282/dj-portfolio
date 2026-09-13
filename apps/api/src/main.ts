// MUST be first. Applies this app's env files with override before anything
// requires @prisma/client, which would otherwise auto-load packages/db/.env
// and silently win. See src/bootstrap-env.ts for the full explanation.
import './bootstrap-env';

import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';

import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { buildOpenApiDocument } from './openapi';

/**
 * Bootstrap.
 *
 * See docs/02-architecture/backend.md. The ordering choices below are all
 * deliberate; the comments say which ones would break something if moved.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Buffer startup logs until Pino is attached, so early messages are not
    // lost to the default logger and appear in the same structured stream.
    bufferLogs: true,
  });

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.useLogger(app.get(Logger));
  // Ensures a thrown error is logged with its stack by Pino rather than only
  // being serialised into the problem response.
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  // Railway terminates TLS at its edge, so without this `req.ip` is the proxy
  // and every per-IP rate limit collapses into one bucket for the whole
  // internet.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Cloudinary assets are served cross-origin by design.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The API returns JSON, never HTML, so a CSP here protects nothing.
      // The real CSP lives on the two Next apps.
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser(config.get('COOKIE_SECRET', { infer: true })));

  // 256kb is generous for JSON and far below anything that could exhaust
  // memory. Media never passes through here — uploads go browser-to-Cloudinary
  // with a signed payload, which is the point of that design.
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  // /health is excluded so platform probes hit a stable, unversioned path.
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    exposedHeaders: [
      'ETag',
      'X-Request-Id',
      'X-Total-Count',
      'Idempotency-Replayed',
      'RateLimit-Remaining',
      'RateLimit-Reset',
    ],
    maxAge: 86_400,
  });

  // Runs PrismaService.onModuleDestroy, so in-flight queries finish instead of
  // being cut off mid-transaction on deploy.
  app.enableShutdownHooks();

  // We emit strong ETags ourselves in HttpCacheInterceptor, computed from a
  // stable serialisation. Express's own weak ETag would conflict.
  app.set('etag', false);
  app.disable('x-powered-by');

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    // Built by src/openapi.ts, which the snapshot test also uses, so the
    // served document and the committed contract cannot diverge.
    const document = buildOpenApiDocument(app);

    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'DJ Felicitous API',
    });
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    `API listening on port ${String(port)} [${isProduction ? 'production' : 'development'}]`,
  );

  if (!isProduction && config.get('SWAGGER_ENABLED', { infer: true })) {
    logger.log(`OpenAPI docs at http://localhost:${String(port)}/api/docs`);
  }
}

void bootstrap();
