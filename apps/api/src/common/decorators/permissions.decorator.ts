import { SetMetadata } from '@nestjs/common';

import { PERMISSIONS_KEY } from '../constants';

/**
 * Requires every listed `resource:action` permission.
 *
 * ALL of them, not any — a route that needs both `event:write` and
 * `media:read` should fail for a user holding only one. Where "any of" is
 * genuinely wanted, express it as a single coarser permission instead of
 * weakening this.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
