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

import type { StatAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto } from '../../common/dto/content.dto';

import { StatAdminQueryDto, StatCreateDto, StatUpdateDto } from './dto/stat.dto';
import { StatsService } from './stats.service';

/** No publish workflow: `Stat` has no `status` column. See NON_PUBLISHABLE. */
@ApiTags('admin: stats')
@ApiBearerAuth()
@Controller('admin/stats')
@CacheControl(CACHE_POLICIES.noStore)
export class StatsAdminController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @RequirePermissions('stat:read')
  @ApiOperation({ summary: 'List stats, offset-paginated' })
  async list(@Query() query: StatAdminQueryDto) {
    const result = await this.stats.listAdmin({
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
  @RequirePermissions('stat:read')
  @ApiOperation({ summary: 'One stat by id' })
  async findOne(@Param('id') id: string): Promise<StatAdminDetail> {
    return this.stats.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('stat:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.stats.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('stat:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Stat' })
  @ApiOperation({ summary: 'Create a stat' })
  async create(@Body() dto: StatCreateDto): Promise<StatAdminDetail> {
    return this.stats.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('stat:write')
  @ApiOperation({ summary: 'Update a stat. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: StatUpdateDto): Promise<StatAdminDetail> {
    return this.stats.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('stat:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a stat',
    description: 'A real delete — Stat has no deletedAt. Nothing else references a stat.',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.stats.remove(id);
  }
}
