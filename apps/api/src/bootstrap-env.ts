import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

/**
 * Loads this app's env files FIRST, and with override.
 *
 * ## Why this file exists
 *
 * `@prisma/client` auto-loads the `.env` sitting next to its schema — in this
 * repo, `packages/db/.env` — and it does so at **require time**, which is
 * before `ConfigModule.forRoot()` ever runs. dotenv does not override an
 * existing `process.env` value, so the sibling package's file silently wins
 * over `apps/api/.env.local`.
 *
 * The symptom is brutal to debug: the API connects to whatever database
 * `packages/db/.env` names, `ConfigService.get('DATABASE_URL')` returns that
 * same wrong value so nothing looks inconsistent, and the only clue is a
 * connection error naming a host you never configured.
 *
 * Importing this module as the **first statement in main.ts** fixes the
 * precedence: the app's own files are applied with `override: true` before
 * anything pulls in Prisma. That ordering is the entire point of the file, so
 * do not move the import, and do not fold it into main.ts — CommonJS
 * evaluates `require` calls in source order, which is what makes a
 * side-effect import work here at all.
 *
 * Precedence, highest first:
 *   1. the real process environment set by the platform (Railway, Vercel, CI)
 *   2. apps/api/.env.local
 *   3. apps/api/.env
 *
 * See docs/05-operations/env-vars.md
 */

/**
 * The platform environment, snapshotted before anything is overridden.
 *
 * This must be taken first: the loop below mutates `process.env`, so afterwards
 * there is no way to tell an original value from one a file just wrote.
 */
const platformEnv = new Map<string, string>(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

/** Loaded in ascending priority, so `.env.local` beats `.env`. */
for (const file of ['.env', '.env.local']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    loadDotenv({ path, override: true });
  }
}

/**
 * Restore anything the platform had already set.
 *
 * Without this, a stray `.env.local` baked into a deployed image would
 * override real production configuration — which is a far worse failure than
 * the one this file exists to fix.
 */
for (const [key, value] of platformEnv) {
  process.env[key] = value;
}
