/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';
import { Client } from 'pg';

/**
 * Applies prisma/sql/post-migrate.sql.
 *
 * Run after every `prisma migrate deploy`:
 *   local     pnpm db:migrate  (chains both)
 *   Railway   pre-deploy command chains both
 *
 * The SQL is idempotent by contract, so re-running is a no-op.
 *
 * Uses a plain `pg` client rather than `prisma.$executeRawUnsafe`, because
 * Prisma sends raw queries as prepared statements and Postgres rejects a
 * multi-statement batch in one of those:
 *   `42601: cannot insert multiple commands into a prepared statement`
 * The alternative — splitting the file on semicolons — means hand-rolling a
 * SQL lexer that has to understand string and dollar-quoted literals, which
 * is a worse trade than one dev-only dependency. `pg` is devDependency-only
 * migration tooling and is never shipped in the API bundle.
 *
 * See docs/05-operations/migrations.md
 */
const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, '..', 'prisma', 'sql', 'post-migrate.sql');

async function main(): Promise<void> {
  // DDL needs a session, so this uses the unpooled connection for the same
  // reason migrations do: PgBouncer transaction mode cannot hold one.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set.');
  }

  const sql = readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString });

  console.log(`Applying ${sqlPath}`);
  const started = Date.now();

  await client.connect();
  try {
    // One transaction: either every index and constraint lands, or none does.
    // A half-applied run would leave the database quietly missing a guard.
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Post-migration SQL applied in ${String(Date.now() - started)}ms`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    '\nPost-migration SQL failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
