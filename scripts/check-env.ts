/* eslint-disable no-console */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Asserts that every `.env.example` stays in sync with what the code reads.
 *
 * The failure this prevents: someone adds `process.env.NEW_THING` to the API,
 * it works locally because their own `.env.local` has it, and the production
 * deploy fails to boot — or worse, silently degrades. Documenting the variable
 * is not a nice-to-have here, it is what makes the deploy reproducible.
 *
 * Two checks:
 *   1. apps/api  — `.env.example` keys must exactly match `env.schema.ts`.
 *   2. Next apps — every `process.env.X` referenced in source must appear in
 *      `.env.example`, and every `NEXT_PUBLIC_*` key must NOT look like a
 *      secret.
 *
 * See docs/05-operations/env-vars.md
 */

const root = process.cwd();

/** Keys the platform provides; never declared in an example file. */
const PLATFORM_PROVIDED = new Set([
  'NODE_ENV',
  'VERCEL_ENV',
  'VERCEL_URL',
  'CI',
  'PORT',
  'npm_lifecycle_event',
]);

/** Substrings that must never appear in a NEXT_PUBLIC_ variable name. */
const SECRET_MARKERS = ['SECRET', 'PASSWORD', 'PRIVATE', 'TOKEN', 'API_KEY'];

/**
 * Named, deliberate exceptions to the rule above — narrowed on purpose
 * rather than disabled, per CLAUDE.md's own convention for a rule that is
 * right in general but wrong for one specific case.
 *
 * `NEXT_PUBLIC_PREVIEW_TOKEN` (apps/admin only) really is client-visible by
 * design: it has to be embedded in the admin bundle so a signed-in editor's
 * browser can build a "Preview"/"View live site" link into apps/web's Draft
 * Mode route. Its blast radius if leaked is "see draft content early," not
 * anything destructive, and admin itself sits behind auth — see
 * apps/admin/src/lib/preview.ts.
 */
const NEXT_PUBLIC_SECRET_EXCEPTIONS = new Set(['NEXT_PUBLIC_PREVIEW_TOKEN']);

const errors: string[] = [];
const warnings: string[] = [];

function parseExampleKeys(path: string): Set<string> {
  const keys = new Set<string>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    // Commented-out variables count as documented: they mark optional keys.
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(trimmed);
    if (match?.[1]) keys.add(match[1]);
  }
  return keys;
}

// ── 1. apps/api: example file vs Zod schema ────────────────────────────────
function checkApi(): void {
  const schemaPath = join(root, 'apps/api/src/config/env.schema.ts');
  const examplePath = join(root, 'apps/api/.env.example');

  if (!existsSync(schemaPath) || !existsSync(examplePath)) {
    warnings.push('apps/api: env.schema.ts or .env.example missing, skipping');
    return;
  }

  const schemaSource = readFileSync(schemaPath, 'utf8');
  const body = /envSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\);/.exec(schemaSource)?.[1] ?? '';

  const schemaKeys = new Set([...body.matchAll(/^\s{2}([A-Z][A-Z0-9_]*)\s*:/gm)].map((m) => m[1]!));

  if (schemaKeys.size === 0) {
    errors.push('apps/api: could not parse any keys out of env.schema.ts');
    return;
  }

  const exampleKeys = parseExampleKeys(examplePath);

  for (const key of schemaKeys) {
    if (!exampleKeys.has(key) && !PLATFORM_PROVIDED.has(key)) {
      errors.push(`apps/api: ${key} is in env.schema.ts but not in .env.example`);
    }
  }
  for (const key of exampleKeys) {
    if (!schemaKeys.has(key)) {
      errors.push(`apps/api: ${key} is in .env.example but not validated in env.schema.ts`);
    }
  }

  console.log(`apps/api: ${String(schemaKeys.size)} validated variables`);
}

// ── 2. Next apps: process.env usage vs example file ────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function checkNextApp(app: string): void {
  const appDir = join(root, 'apps', app);
  const examplePath = join(appDir, '.env.example');
  if (!existsSync(examplePath)) {
    warnings.push(`apps/${app}: .env.example missing, skipping`);
    return;
  }

  const exampleKeys = parseExampleKeys(examplePath);
  const referenced = new Set<string>();

  for (const file of [...walk(join(appDir, 'src')), join(appDir, 'next.config.ts')]) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      referenced.add(m[1]!);
    }
  }

  for (const key of referenced) {
    if (!exampleKeys.has(key) && !PLATFORM_PROVIDED.has(key)) {
      errors.push(`apps/${app}: process.env.${key} is used but not in .env.example`);
    }
  }

  // A secret behind NEXT_PUBLIC_ is shipped to every visitor's browser.
  for (const key of exampleKeys) {
    if (
      key.startsWith('NEXT_PUBLIC_') &&
      SECRET_MARKERS.some((s) => key.includes(s)) &&
      !NEXT_PUBLIC_SECRET_EXCEPTIONS.has(key)
    ) {
      errors.push(
        `apps/${app}: ${key} looks like a secret but is NEXT_PUBLIC_ — it would be exposed to the browser`,
      );
    }
  }

  console.log(
    `apps/${app}: ${String(exampleKeys.size)} documented, ${String(referenced.size)} referenced`,
  );
}

// ── run ─────────────────────────────────────────────────────────────────────
console.log('Checking environment variable parity...\n');

checkApi();
for (const app of ['web', 'admin']) checkNextApp(app);

if (warnings.length > 0) {
  console.log('');
  for (const w of warnings) console.warn(`  ! ${w}`);
}

if (errors.length > 0) {
  console.error(`\n${String(errors.length)} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('\nSee docs/05-operations/env-vars.md\n');
  process.exitCode = 1;
} else {
  console.log('\nEnvironment parity OK\n');
}
