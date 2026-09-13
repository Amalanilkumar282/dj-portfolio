import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * End-to-end suite: boots the real Nest app against a real database.
 *
 * Separate from the unit config so `pnpm test` stays fast and runnable with
 * no infrastructure, while `pnpm test:e2e` is the one that needs Postgres.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    root: '.',
    include: ['test/**/*.e2e-spec.ts'],
    // Required, not cosmetic: this app's env files must be applied before
    // anything requires @prisma/client. See test/setup-env.ts.
    setupFiles: ['./test/setup-env.ts'],
    // One app instance and one database; parallel files would fight over both.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
