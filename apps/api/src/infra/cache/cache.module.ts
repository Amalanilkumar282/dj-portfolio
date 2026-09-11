import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema';

/**
 * L3 cache — in-process only, deliberately.
 *
 * The Next.js tag-based Data Cache absorbs virtually all public read traffic,
 * so the API sees near-zero requests per second in steady state. At one
 * replica an in-process LRU is strictly faster than a network hop to Redis.
 *
 * `REDIS_URL` is the switch, and it becomes mandatory the moment there is more
 * than one API replica: an in-process cache is then incoherent, serving one
 * visitor stale content and another fresh with no discernible pattern. Rather
 * than let that happen quietly, setting the variable before the store exists
 * fails the boot.
 *
 * See docs/01-decisions/0006-no-redis-at-launch.md
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const redisUrl = config.get('REDIS_URL', { infer: true });

        if (redisUrl) {
          throw new Error(
            'REDIS_URL is set but the Redis store is not implemented yet. Read ' +
              'docs/01-decisions/0006-no-redis-at-launch.md before enabling it.',
          );
        }

        return { ttl: 60_000, max: 500 };
      },
    }),
  ],
})
export class AppCacheModule {}
