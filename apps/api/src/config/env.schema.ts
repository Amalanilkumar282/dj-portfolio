import { z } from 'zod';

/**
 * A real string -> boolean parser for env vars.
 *
 * `z.coerce.boolean()` looks like it does this already, but it does not: it
 * runs the raw string through JavaScript's `Boolean(x)`, which is true for
 * *any* non-empty string — including the literal text `"false"`. Every
 * environment variable arrives as a string, so `SWAGGER_ENABLED=false` in a
 * real deploy's dashboard coerced to `true` regardless of intent, and the
 * production guard below rejected it every single boot. Confirmed live: a
 * Render deploy with `SWAGGER_ENABLED=false` set in the dashboard still
 * failed with "SWAGGER_ENABLED must be false in production."
 */
const booleanFromEnv = z
  .string()
  .default('false')
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0', '']))
  .transform((value) => value === 'true' || value === '1');

/**
 * Environment schema — the runtime source of truth for API configuration.
 *
 * Boot **fails** on invalid config, deliberately. A container that starts
 * with a missing RESEND_API_KEY and silently drops booking emails is a
 * business bug, not a config bug.
 *
 * `pnpm check:env` asserts key parity between this schema and
 * `.env.example`, so a variable cannot be added to code without being
 * documented.
 *
 * See docs/05-operations/env-vars.md
 */
export const envSchema = z.object({
  // ── runtime ────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_PUBLIC_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Must be false in production. */
  SWAGGER_ENABLED: booleanFromEnv,

  // ── database ───────────────────────────────────────────────────────────
  /** Pooled. Neon -pooler endpoint with pgbouncer=true. See ADR 0005. */
  DATABASE_URL: z.string().url(),
  /** Unpooled. Migrations and DDL need a session. */
  DIRECT_URL: z.string().url(),

  // ── auth ───────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z.string().min(48),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(48),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().default(30),
  COOKIE_SECRET: z.string().min(32),
  /** admin.djfelicitous.com in production — scoping the session away from the
   *  public origin is deliberate. See ADR 0002. */
  COOKIE_DOMAIN: z.string().default('localhost'),
  /** 32 bytes hex. AES-256-GCM for totpSecret at rest. Rotating this without
   *  re-encrypting locks every 2FA user out — see the secret-rotation runbook. */
  TOTP_ENCRYPTION_KEY: z.string().length(64),

  // ── CORS ───────────────────────────────────────────────────────────────
  /** Comma-separated. Never '*' — credentials are enabled. */
  CORS_ORIGINS: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),

  // ── media ──────────────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  /** Server only. Must never reach a frontend. */
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLOUDINARY_ROOT_FOLDER: z.string().default('djf-dev'),

  // ── email ──────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().startsWith('re_'),
  MAIL_FROM: z.string().min(1),
  BOOKING_NOTIFY_TO: z.string().email(),

  // ── web integration ────────────────────────────────────────────────────
  WEB_BASE_URL: z.string().url(),
  /** Must match apps/web. A mismatch means published content silently stops
   *  appearing — the most common cause of that symptom. */
  REVALIDATE_SECRET: z.string().min(32),
  API_KEY: z.string().min(32),
  PREVIEW_TOKEN: z.string().min(32),

  // ── anti-abuse ─────────────────────────────────────────────────────────
  TURNSTILE_SECRET_KEY: z.string().min(1),
  /** Salt for PageView.visitorHash and ipHash. Rotating breaks
   *  visitor-uniqueness continuity, so rotate deliberately. */
  ANALYTICS_HASH_SALT: z.string().min(16),

  // ── optional ───────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
  /** Absent means the in-memory LRU cache. See ADR 0006. */
  REDIS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment, throwing a readable aggregate error.
 *
 * Wired into `ConfigModule.forRoot({ validate })`, so an invalid environment
 * stops the process rather than surfacing as a confusing runtime failure
 * hours later.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}\n`);
  }

  if (result.data.NODE_ENV === 'production' && result.data.SWAGGER_ENABLED) {
    throw new Error('SWAGGER_ENABLED must be false in production.');
  }

  return result.data;
}
