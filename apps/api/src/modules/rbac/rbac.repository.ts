import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';

export interface RoleWithPermissions {
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

@Injectable()
export class RbacRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves a user's roles and flattened permissions.
   *
   * Called once per login and once per refresh, then baked into the access
   * token — never per request. That is what keeps `PermissionsGuard` free of a
   * database round trip.
   */
  async resolveForUser(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const assignments = await this.prisma.client.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    const roles = assignments.map((assignment) => assignment.role.key);

    // A Set because roles overlap: an owner and an editor share most grants,
    // and duplicates would bloat the token for no reason.
    const permissions = new Set<string>();
    for (const assignment of assignments) {
      for (const grant of assignment.role.permissions) {
        permissions.add(grant.permission.key);
      }
    }

    return { roles, permissions: [...permissions].sort() };
  }

  async listRoles(): Promise<RoleWithPermissions[]> {
    const roles = await this.prisma.client.role.findMany({
      orderBy: { key: 'asc' },
      include: {
        permissions: { include: { permission: { select: { key: true } } } },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      permissions: role.permissions.map((grant) => grant.permission.key).sort(),
    }));
  }

  async listPermissions(): Promise<{ key: string; resource: string; action: string }[]> {
    return this.prisma.client.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      select: { key: true, resource: true, action: true },
    });
  }

  async findRoleByKey(key: string): Promise<{ id: string; key: string } | null> {
    return this.prisma.client.role.findUnique({
      where: { key },
      select: { id: true, key: true },
    });
  }

  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    await this.prisma.client.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId, assignedBy: assignedBy ?? null },
      update: {},
    });
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.client.userRole.deleteMany({ where: { userId, roleId } });
  }

  /** How many users hold a role. Guards the "last owner" check. */
  async countUsersWithRole(roleKey: string): Promise<number> {
    return this.prisma.client.userRole.count({ where: { role: { key: roleKey } } });
  }
}
