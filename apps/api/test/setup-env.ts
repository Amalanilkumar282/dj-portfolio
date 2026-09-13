/**
 * Applies this app's env files before any test imports AppModule.
 *
 * `main.ts` does this as its first import, but the e2e suite boots the app via
 * `Test.createTestingModule({ imports: [AppModule] })` and never loads
 * `main.ts` — so without this file the fix is silently absent under test.
 *
 * The symptom is specific and misleading: `@prisma/client` auto-loads
 * `packages/db/.env` at require time, dotenv refuses to override an existing
 * value, and the suite fails with "Can't reach database server at
 * localhost:5432" while `apps/api/.env.local` plainly says otherwise.
 *
 * Registered as a vitest `setupFiles` entry, which runs before the test
 * module graph is imported. See src/bootstrap-env.ts for the full rationale.
 */
import '../src/bootstrap-env';
