import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Replaces the deprecated `package.json#prisma` key. Only the CLI reads this
 * file — the API constructs its own PrismaClient from validated env
 * (apps/api/src/config/env.schema.ts).
 *
 * See docs/05-operations/migrations.md
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Layered seeds: `system` is idempotent and runs in every environment
    // including production; `content` and `demo` are dev/preview only.
    // See seed/index.ts
    seed: 'tsx seed/index.ts',
  },
});
