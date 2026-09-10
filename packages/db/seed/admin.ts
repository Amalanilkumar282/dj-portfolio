import { hash } from '@node-rs/argon2';

import type { ExtendedPrismaClient } from '../src/client.js';

import type { SeedLogger } from './logger.js';

/**
 * First administrator.
 *
 * OWASP-recommended argon2id parameters for interactive login. These are
 * duplicated in the API's auth service; docs/02-architecture/auth-and-rbac.md
 * is the reference and both must be changed together.
 */
export const ARGON2_OPTIONS = {
  // argon2id
  algorithm: 2 as const,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} satisfies Parameters<typeof hash>[1];

/**
 * Creates the initial SUPER_ADMIN from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD.
 *
 * Refuses to run in production if a SUPER_ADMIN already exists, so a routine
 * deploy can never mint an extra owner account or reset the real one's
 * password from a stale environment variable.
 */
export async function seedAdmin(prisma: ExtendedPrismaClient, log: SeedLogger): Promise<void> {
  log.section('admin user');

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!email || !password) {
    log.warn('ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — skipping');
    return;
  }

  if (password.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters.');
  }

  const role = await prisma.role.findUnique({ where: { key: 'SUPER_ADMIN' } });
  if (!role) {
    throw new Error('SUPER_ADMIN role not found. Run the system seed first.');
  }

  const existingOwners = await prisma.userRole.count({ where: { roleId: role.id } });

  if (existingOwners > 0) {
    if (isProduction) {
      log.warn(
        `${String(existingOwners)} SUPER_ADMIN already exists — refusing to seed in production`,
      );
      return;
    }
    log.step(`${String(existingOwners)} SUPER_ADMIN already present`);
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Owner',
      passwordHash,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    // Outside production, re-running the seed resets the dev password, which
    // is the behaviour you want when you have forgotten it.
    update: isProduction ? {} : { passwordHash, isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });

  log.step(`SUPER_ADMIN ${email}`);

  if (!isProduction) {
    log.warn('TOTP two-factor is NOT enrolled by the seed — enrol it on first login');
  }
}
