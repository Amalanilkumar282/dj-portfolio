import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { VenueAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { VenueAdminQueryDto, VenueCreateDto, VenueUpdateDto } from './dto/venue.dto';
import { VenuesService } from './venues.service';

/**
 * Admin venue writes.
 *
 * The class-level decorators are the security boundary: every route here is
 * authenticated (the global `JwtAccessGuard` denies by default and nothing
 * opts out), permission-checked, and `no-store`.
 *
 * Writes are by **id**, not slug. Slugs change; ids do not, so an admin form
 * holding an id keeps working after a rename.
 *
 * See docs/02-architecture/backend.md
 */
@ApiTags('admin: venues')
@ApiBearerAuth()
@Controller('admin/venues')
@CacheControl(CACHE_POLICIES.noStore)
export class VenuesAdminController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @RequirePermissions('venue:read')
  @ApiOperation({ summary: 'List venues of every status, offset-paginated' })
  async list(@Query() query: VenueAdminQueryDto) {
    const result = await this.venues.listAdmin({
      status: query.status,
      q: query.q,
      sort: [{ field: 'sortIndex', direction: 'asc' }],
      page: query.page,
      perPage: query.perPage,
    });

    return {
      data: result.data,
      meta: {
        pagination: {
          mode: 'offset' as const,
          limit: query.perPage,
          page: result.page,
          totalPages: result.totalPages,
          totalCount: result.total,
          hasMore: result.page < result.totalPages,
        },
      },
    };
  }

  @Get(':id')
  @RequirePermissions('venue:read')
  @ApiOperation({ summary: 'One venue by id, any status' })
  async findOne(@Param('id') id: string): Promise<VenueAdminDetail> {
    return this.venues.findAdminById(id);
  }

  /**
   * Bulk reorder.
   *
   * **Must stay above `@Patch(':id')`.** Routes match in declaration order, so
   * a `:id` route declared first swallows `/reorder` and tries to update a
   * venue whose id is the literal string "reorder" — a 404 that looks like a
   * missing record rather than a routing mistake.
   */
  @Patch('reorder')
  @RequirePermissions('venue:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.venues.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('venue:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Venue' })
  @ApiOperation({ summary: 'Create a venue' })
  async create(@Body() dto: VenueCreateDto): Promise<VenueAdminDetail> {
    return this.venues.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('venue:write')
  @ApiOperation({ summary: 'Update a venue. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: VenueUpdateDto): Promise<VenueAdminDetail> {
    return this.venues.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  // Separate from `venue:write` on purpose: an editor may draft freely while
  // only an owner decides what goes live.
  @RequirePermissions('venue:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<VenueAdminDetail> {
    await this.venues.publish(id, new Date());
    return this.venues.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('venue:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<VenueAdminDetail> {
    await this.venues.unpublish(id);
    return this.venues.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('venue:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<VenueAdminDetail> {
    await this.venues.archive(id);
    return this.venues.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('venue:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<VenueAdminDetail> {
    await this.venues.schedule(id, dto.publishAt, new Date());
    return this.venues.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('venue:write')
  // 200, not POST's default 201: this returns a venue that already existed
  // rather than creating one.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<VenueAdminDetail> {
    await this.venues.restore(id);
    return this.venues.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('venue:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.venues.remove(id);
  }
}
