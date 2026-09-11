import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { REQUEST_ID_HEADER } from '../../common/constants';
import type { Env } from '../../config/env.schema';

/**
 * Structured logging.
 *
 * Two things here are load-bearing rather than cosmetic:
 *
 * 1. `genReqId` honours an inbound `x-request-id` and always echoes it. That
 *    is what makes a user-reported error traceable — the same id appears in
 *    the RFC 9457 problem response as `requestId` and on every log line, so a
 *    screenshot of an error is enough to find the request.
 *
 * 2. `redact` is not optional. An access log containing a password or a
 *    session cookie is a breach. Add to this list whenever a new sensitive
 *    field appears on a request body.
 *
 * See docs/05-operations/observability.md
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isDev = config.get('NODE_ENV', { infer: true }) === 'development';

        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),

            genReqId: (req, res) => {
              const inbound = req.headers[REQUEST_ID_HEADER];
              const id = (Array.isArray(inbound) ? inbound[0] : inbound) ?? randomUUID();
              res.setHeader(REQUEST_ID_HEADER, id);
              return id;
            },

            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.currentPassword',
                'req.body.newPassword',
                'req.body.totp',
                'req.body.token',
                'req.body.refreshToken',
              ],
              censor: '[redacted]',
            },

            // The uptime monitor hits /health every minute. Logging it drowns
            // everything that matters.
            autoLogging: {
              ignore: (req) => (req.url ?? '').startsWith('/health'),
            },

            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },

            // Spread rather than assigned: `exactOptionalPropertyTypes` makes
            // an explicit `undefined` a type error here, and in production we
            // want the key absent so pino writes raw JSON to stdout for the
            // log drain.
            ...(isDev
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: { singleLine: true, colorize: true },
                  },
                }
              : {}),
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
