/* eslint-disable no-console */
import 'dotenv/config';

import { createPrismaClient } from '../src/client.js';
import { runWithDbContext } from '../src/context.js';

import { seedAdmin } from './admin.js';
import { seedContent } from './content.js';
import { seedDemo } from './demo.js';
import { createSeedLogger } from './logger.js';
import { seedSystem } from './system.js';

/**
 * Seed entry point.
 *
 * Three layers, run in order, each safe to run on its own:
 *
 *   system   idempotent structural data. Runs in EVERY environment,
 *            including production on deploy.
 *   admin    the first SUPER_ADMIN. Guarded in production.
 *   content  real copy harvested from the legacy site. Dev/preview only.
 *   demo     explicitly synthetic volume data. Dev only.
 *
 * Usage:
 *   pnpm db:seed                  # everything appropriate for NODE_ENV
 *   pnpm db:seed --only=system    # a single layer
 *   pnpm db:seed --only=system,content
 *
 * See docs/05-operations/migrations.md
 */

type Layer = 'system' | 'admin' | 'content' | 'demo';
const ALL_LAYERS: Layer[] = ['system', 'admin', 'content', 'demo'];

function parseLayers(): Layer[] {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  const env = process.env.NODE_ENV ?? 'development';

  if (arg) {
    const requested = arg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim());
    const invalid = requested.filter((r) => !ALL_LAYERS.includes(r as Layer));
    if (invalid.length > 0) {
      throw new Error(
        `Unknown seed layer(s): ${invalid.join(', ')}. Valid: ${ALL_LAYERS.join(', ')}`,
      );
    }
    return requested as Layer[];
  }

  // Defaults by environment. Production gets structural data only — loading
  // harvested dev copy would overwrite whatever has been published.
  if (env === 'production') return ['system'];
  if (env === 'test') return ['system'];
  return ALL_LAYERS;
}

async function main(): Promise<void> {
  const log = createSeedLogger();
  const layers = parseLayers();
  const env = process.env.NODE_ENV ?? 'development';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy packages/db/.env.example to .env.');
  }

  console.log(`\nSeeding [${env}]: ${layers.join(' → ')}`);

  const prisma = createPrismaClient();
  const started = Date.now();

  try {
    // Attributes every createdBy/updatedBy to "system" rather than leaving a
    // misleading null actor on seeded rows.
    await runWithDbContext({ system: true, requestId: 'seed' }, async () => {
      if (layers.includes('system')) await seedSystem(prisma, log);
      if (layers.includes('admin')) await seedAdmin(prisma, log);

      if (layers.includes('content')) {
        if (env === 'production') {
          log.warn('refusing to run the content seed in production');
        } else {
          await seedContent(prisma, log);
        }
      }

      if (layers.includes('demo')) {
        if (env !== 'development') {
          log.warn(`refusing to run the demo seed in ${env}`);
        } else {
          await seedDemo(prisma, log);
        }
      }
    });

    log.done(`Seed complete in ${String(Date.now() - started)}ms`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\nSeed failed:\n', error);
  process.exitCode = 1;
});
