import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration specs share one database, so they must not race.
    fileParallelism: false,
    include: ['src/**/*.{spec,int-spec}.ts', 'seed/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/index.ts'],
    },
  },
});
