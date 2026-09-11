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

import type { GearItemAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { GearAdminQueryDto, GearCreateDto, GearUpdateDto } from './dto/gear.dto';
import { GearService } from './gear.service';

@ApiTags('admin: gear')
@ApiBearerAuth()
@Controller('admin/gear')
@CacheControl(CACHE_POLICIES.noStore)
export class GearAdminController {
  constructor(private readonly gear: GearService) {}

  @Get()
  @RequirePermissions('gear:read')
  @ApiOperation({ summary: 'List gear items of every status, offset-paginated' })
  async list(@Query() query: GearAdminQueryDto) {
    const result = await this.gear.listAdmin({
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
  @RequirePermissions('gear:read')
  @ApiOperation({ summary: 'One gear item by id' })
  async findOne(@Param('id') id: string): Promise<GearItemAdminDetail> {
    return this.gear.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('gear:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.gear.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('gear:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'GearItem' })
  @ApiOperation({ summary: 'Create a gear item' })
  async create(@Body() dto: GearCreateDto): Promise<GearItemAdminDetail> {
    return this.gear.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('gear:write')
  @ApiOperation({ summary: 'Update a gear item. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: GearUpdateDto): Promise<GearItemAdminDetail> {
    return this.gear.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('gear:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<GearItemAdminDetail> {
    await this.gear.publish(id, new Date());
    return this.gear.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('gear:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<GearItemAdminDetail> {
    await this.gear.unpublish(id);
    return this.gear.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('gear:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<GearItemAdminDetail> {
    await this.gear.archive(id);
    return this.gear.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('gear:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<GearItemAdminDetail> {
    await this.gear.schedule(id, dto.publishAt, new Date());
    return this.gear.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('gear:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<GearItemAdminDetail> {
    await this.gear.restore(id);
    return this.gear.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('gear:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.gear.remove(id);
  }
}
