import { SetMetadata } from '@nestjs/common';

import type { AuditAction } from '@dj/db';

import { AUDIT_KEY } from '../constants';

export interface AuditMetadata {
  action: AuditAction;
  /** Model name, e.g. "Event". Omitted for non-entity actions like LOGIN. */
  entityType?: string;
  /** Route param holding the entity id. Defaults to "id". */
  idParam?: string;
}

/**
 * Records an AuditLog row for this route.
 *
 * The interceptor writes the row AFTER the handler succeeds, so a failed
 * request leaves no misleading trail. Auth actions write their own rows from
 * inside AuthService instead, because a FAILED login must also be recorded and
 * an interceptor never sees those.
 */
export const Audited = (metadata: AuditMetadata) => SetMetadata(AUDIT_KEY, metadata);
