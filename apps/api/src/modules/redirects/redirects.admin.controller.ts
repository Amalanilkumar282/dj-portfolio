import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RedirectAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import { Audited, CacheControl, CACHE_POLICIES, Idempotent, RequirePermissions } from '../../common/decorators';

import { RedirectAdminQueryDto, RedirectCreateDto, RedirectUpdateDto } from './dto/redirect.dto';
import { RedirectsService } from './redirects.service';

/** No publish workflow: `Redirect` has no `status` column. */
@ApiTags('admin: redirects')
@ApiBearerAuth()
@Controller('admin/redirects')
@CacheControl(CACHE_POLICIES.noStore)
export class RedirectsAdminController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @RequirePermissions('redirect:read')
  @ApiOperation({ summary: 'List redirects, offset-paginated' })
  async list(@Query() query: RedirectAdminQueryDto) {
    const result = await this.redirects.listAdmin({
      q: query.q,
      activeOnly: query.activeOnly,
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
  @RequirePermissions('redirect:read')
  @ApiOperation({ summary: 'One redirect by id' })
  async findOne(@Param('id') id: string): Promise<RedirectAdminDetail> {
    return this.redirects.findAdminById(id);
  }

  @Post()
  @RequirePermissions('redirect:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Redirect' })
  @ApiOperation({ summary: 'Create a redirect' })
  async create(@Body() dto: RedirectCreateDto): Promise<RedirectAdminDetail> {
    return this.redirects.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('redirect:write')
  @ApiOperation({ summary: 'Update a redirect. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: RedirectUpdateDto): Promise<RedirectAdminDetail> {
    return this.redirects.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('redirect:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a redirect',
    description: 'A real delete — Redirect has no deletedAt, and nothing else references one.',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.redirects.remove(id);
  }
}
