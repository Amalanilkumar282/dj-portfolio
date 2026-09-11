import { Injectable } from '@nestjs/common';

import { RbacRepository, type RoleWithPermissions } from './rbac.repository';

/** The role that must always have at least one holder. */
export const OWNER_ROLE = 'SUPER_ADMIN';

@Injectable()
export class RbacService {
  constructor(private readonly repository: RbacRepository) {}

  /**
   * Roles and flattened permissions for a user.
   *
   * Called at login and refresh only; the result is baked into the access
   * token so PermissionsGuard needs no query per request.
   */
  async resolveForUser(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    return this.repository.resolveForUser(userId);
  }

  async listRoles(): Promise<RoleWithPermissions[]> {
    return this.repository.listRoles();
  }

  async listPermissions(): Promise<{ key: string; resource: string; action: string }[]> {
    return this.repository.listPermissions();
  }

  async findRoleByKey(key: string) {
    return this.repository.findRoleByKey(key);
  }

  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    await this.repository.assignRole(userId, roleId, assignedBy);
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.repository.revokeRole(userId, roleId);
  }

  /**
   * True when removing this role from this user would leave the system with no
   * owner.
   *
   * Locking everyone out of production is unrecoverable without database
   * access, so the check is cheap insurance.
   */
  async wouldOrphanOwnership(roleKey: string): Promise<boolean> {
    if (roleKey !== OWNER_ROLE) return false;
    return (await this.repository.countUsersWithRole(OWNER_ROLE)) <= 1;
  }
}
