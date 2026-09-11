import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest for a NestJS app.
 *
 * The SWC plugin is required, not optional: Vitest transforms with esbuild,
 * which does not support `emitDecoratorMetadata`. Without it every
 * constructor-injected dependency resolves as `undefined` and the DI container
 * fails in ways that look like unrelated null errors.
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
    include: ['src/**/*.spec.ts'],
    // Integration specs share one database, so they must not race.
    fileParallelism: false,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts', 'src/**/dto/**'],
      thresholds: {
        // Auth is hand-rolled, so it carries the strictest bar in the repo.
        // See docs/04-conventions/testing.md
        'src/modules/auth/**': { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
    },
  },
});
