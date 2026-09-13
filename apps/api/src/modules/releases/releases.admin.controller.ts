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

import type { ReleaseAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { ReleaseAdminQueryDto, ReleaseCreateDto, ReleaseUpdateDto } from './dto/release.dto';
import { ReleasesService } from './releases.service';

@ApiTags('admin: releases')
@ApiBearerAuth()
@Controller('admin/releases')
@CacheControl(CACHE_POLICIES.noStore)
export class ReleasesAdminController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  @RequirePermissions('release:read')
  @ApiOperation({ summary: 'List releases of every status, offset-paginated' })
  async list(@Query() query: ReleaseAdminQueryDto) {
    const result = await this.releases.listAdmin({
      status: query.status,
      personaSlug: query.personaSlug,
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
  @RequirePermissions('release:read')
  @ApiOperation({ summary: 'One release by id, any status' })
  async findOne(@Param('id') id: string): Promise<ReleaseAdminDetail> {
    return this.releases.findAdminById(id);
  }

  /** Must stay above `@Patch(':id')` — see docs/02-architecture/backend.md. */
  @Patch('reorder')
  @RequirePermissions('release:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.releases.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('release:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Release' })
  @ApiOperation({ summary: 'Create a release' })
  async create(@Body() dto: ReleaseCreateDto): Promise<ReleaseAdminDetail> {
    return this.releases.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('release:write')
  @ApiOperation({ summary: 'Update a release. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: ReleaseUpdateDto,
  ): Promise<ReleaseAdminDetail> {
    return this.releases.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('release:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<ReleaseAdminDetail> {
    await this.releases.publish(id, new Date());
    return this.releases.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('release:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<ReleaseAdminDetail> {
    await this.releases.unpublish(id);
    return this.releases.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('release:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<ReleaseAdminDetail> {
    await this.releases.archive(id);
    return this.releases.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('release:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<ReleaseAdminDetail> {
    await this.releases.schedule(id, dto.publishAt, new Date());
    return this.releases.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('release:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<ReleaseAdminDetail> {
    await this.releases.restore(id);
    return this.releases.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('release:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.releases.remove(id);
  }
}
