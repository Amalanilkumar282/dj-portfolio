import type { ExtendedPrismaClient } from '../src/client.js';

import { seedPermissions, seedRoles } from './data/rbac.js';
import { seedRedirects } from './data/redirects.js';
import { seedGenres, seedSettings } from './data/site.js';
import { seedPersonas } from './data/personas.js';
import type { SeedLogger } from './logger.js';

/**
 * System seed.
 *
 * Runs in EVERY environment, including production on every deploy, so it must
 * be idempotent. Every write is an upsert on a natural key (permission key,
 * role key, genre slug, persona key, redirect path), never on a generated id.
 *
 * It seeds only structural data — the things the application needs to exist
 * in order to function at all:
 *   - the permission and role matrix
 *   - the SiteSettings singleton
 *   - the canonical genre vocabulary
 *   - the four Persona rows, keyed by PersonaKey
 *   - the legacy URL redirect map
 *
 * Persona *content* (bio, gallery, socials) belongs to the content seed. Here
 * the personas are created as DRAFT shells with only their stable identity,
 * so production gets the right four rows without inheriting dev copy.
 *
 * See docs/05-operations/migrations.md
 */
export async function seedSystem(prisma: ExtendedPrismaClient, log: SeedLogger): Promise<void> {
  log.section('system');

  // --- permissions --------------------------------------------------------
  for (const permission of seedPermissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { resource: permission.resource, action: permission.action },
    });
  }
  log.step(`permissions: ${String(seedPermissions.length)}`);

  // --- roles --------------------------------------------------------------
  for (const role of seedRoles) {
    const permissionKeys =
      role.permissions === '*' ? seedPermissions.map((p) => p.key) : role.permissions;

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });

    const created = await prisma.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
      update: { name: role.name, description: role.description, isSystem: role.isSystem },
    });

    // Replace the grant set wholesale, so removing a permission from the
    // definition actually revokes it on the next deploy.
    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: created.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    log.step(`role ${role.key}: ${String(permissions.length)} permissions`);
  }

  // --- site settings singleton -------------------------------------------
  // The CHECK constraint added in the 20260910000100 migration guarantees
  // there can only ever be this one row.
  await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...seedSettings },
    // Only fill blanks on re-run: the DJ may have edited these in admin and
    // a deploy must not stomp his changes.
    update: {},
  });
  log.step('site settings singleton');

  // --- genres -------------------------------------------------------------
  for (const [index, genre] of seedGenres.entries()) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      create: { ...genre, sortIndex: index },
      update: { name: genre.name },
    });
  }
  log.step(`genres: ${String(seedGenres.length)}`);

  // --- persona shells -----------------------------------------------------
  for (const [index, persona] of seedPersonas.entries()) {
    await prisma.persona.upsert({
      where: { key: persona.key },
      create: {
        key: persona.key,
        slug: persona.slug,
        stageName: persona.stageName,
        subtitle: persona.subtitle,
        primaryGenreLabel: persona.primaryGenreLabel,
        accentColor: persona.accentColor,
        isDuo: persona.isDuo,
        memberNames: persona.memberNames,
        isFeatured: persona.isFeatured,
        // Identity only. Bio and media come from the content seed, so a
        // production deploy does not inherit development copy.
        bio: '',
        sortIndex: index,
      },
      update: {},
    });
  }
  log.step(`persona shells: ${String(seedPersonas.length)}`);

  // --- redirects ----------------------------------------------------------
  for (const redirect of seedRedirects) {
    await prisma.redirect.upsert({
      where: { fromPath: redirect.fromPath },
      create: redirect,
      update: { toPath: redirect.toPath, kind: redirect.kind, note: redirect.note },
    });
  }
  log.step(`redirects: ${String(seedRedirects.length)}`);
}
