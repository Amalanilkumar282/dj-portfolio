import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CacheControl, CACHE_POLICIES, RequirePermissions } from '../../common/decorators';

import { AuditService } from './audit.service';

/**
 * Read-only audit trail — the write side (`AuditService.record`) has existed
 * since Phase 2/3; this is the admin's first way to actually see it (Group
 * E, Phase 11 "next pass"). No filtering DTO/Zod schema for this first cut
 * — every param is optional and coerced defensively, matching the read-only,
 * low-risk nature of this endpoint.
 */
@ApiTags('admin: audit')
@ApiBearerAuth()
@Controller('admin/audit-log')
@CacheControl(CACHE_POLICIES.noStore)
export class AuditAdminController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('auditLog:read')
  @ApiOperation({ summary: 'The audit trail, newest first, optionally filtered by entity' })
  async list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('cursor') cursor?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number.parseInt(takeRaw ?? '50', 10) || 50, 1), 100);
    const rows = await this.audit.list({ entityType, entityId, cursor, take });

    const hasMore = rows.length > take;
    const data = hasMore ? rows.slice(0, take) : rows;
    const last = data.at(-1);

    return {
      data,
      meta: { nextCursor: hasMore && last ? last.id : null },
    };
  }
}
