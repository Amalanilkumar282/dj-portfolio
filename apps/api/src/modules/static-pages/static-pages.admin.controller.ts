import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { StaticPageAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ScheduleDto } from '../../common/dto/content.dto';

import { StaticPageAdminQueryDto, StaticPageCreateDto, StaticPageUpdateDto } from './dto/static-page.dto';
import { StaticPagesService } from './static-pages.service';

/** No `/reorder` route: `StaticPage` has no `sortIndex` column. */
@ApiTags('admin: pages')
@ApiBearerAuth()
@Controller('admin/pages')
@CacheControl(CACHE_POLICIES.noStore)
export class StaticPagesAdminController {
  constructor(private readonly pages: StaticPagesService) {}

  @Get()
  @RequirePermissions('staticPage:read')
  @ApiOperation({ summary: 'List static pages of every status, offset-paginated' })
  async list(@Query() query: StaticPageAdminQueryDto) {
    const result = await this.pages.listAdmin({
      status: query.status,
      q: query.q,
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
  @RequirePermissions('staticPage:read')
  @ApiOperation({ summary: 'One static page by id' })
  async findOne(@Param('id') id: string): Promise<StaticPageAdminDetail> {
    return this.pages.findAdminById(id);
  }

  @Post()
  @RequirePermissions('staticPage:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'StaticPage' })
  @ApiOperation({ summary: 'Create a static page' })
  async create(@Body() dto: StaticPageCreateDto): Promise<StaticPageAdminDetail> {
    return this.pages.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('staticPage:write')
  @ApiOperation({ summary: 'Update a static page. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: StaticPageUpdateDto,
  ): Promise<StaticPageAdminDetail> {
    return this.pages.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('staticPage:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<StaticPageAdminDetail> {
    await this.pages.publish(id, new Date());
    return this.pages.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('staticPage:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<StaticPageAdminDetail> {
    await this.pages.unpublish(id);
    return this.pages.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('staticPage:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<StaticPageAdminDetail> {
    await this.pages.archive(id);
    return this.pages.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('staticPage:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<StaticPageAdminDetail> {
    await this.pages.schedule(id, dto.publishAt, new Date());
    return this.pages.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('staticPage:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<StaticPageAdminDetail> {
    await this.pages.restore(id);
    return this.pages.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('staticPage:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.pages.remove(id);
  }
}
