import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_KEY } from '../constants';
import type { AuditMetadata } from '../decorators/audit.decorator';
import type { AppRequest } from '../types';

/**
 * Writes an AuditLog row for routes marked `@Audited()`.
 *
 * Fires only on success, so a rejected request leaves no misleading trail
 * suggesting a change was made.
 *
 * Auth actions do **not** use this interceptor. A failed login has to be
 * recorded too, and an interceptor never sees a request the guard rejected —
 * so `AuthService` writes its own rows. That split is intentional; do not try
 * to unify it here.
 *
 * See docs/02-architecture/auth-and-rbac.md
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<AppRequest>();

    return next.handle().pipe(
      tap((result: unknown) => {
        const idParam = metadata.idParam ?? 'id';
        const params = request.params as Record<string, string | undefined>;

        // Prefer the id from the route, then from the created entity — a
        // create has no id in the path but returns one in the body.
        const entityId =
          params[idParam] ??
          (result && typeof result === 'object' && 'id' in result ? String(result.id) : undefined);

        // Fire and forget. Audit is important, but failing the request the
        // user just completed successfully because a log row could not be
        // written would be worse than the missing row.
        void this.audit.record({
          action: metadata.action,
          entityType: metadata.entityType,
          entityId,
        });
      }),
    );
  }
}
