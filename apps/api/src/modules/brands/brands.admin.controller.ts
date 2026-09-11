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

import type { BrandAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { BrandsService } from './brands.service';
import { BrandAdminQueryDto, BrandCreateDto, BrandUpdateDto } from './dto/brand.dto';

@ApiTags('admin: brands')
@ApiBearerAuth()
@Controller('admin/brands')
@CacheControl(CACHE_POLICIES.noStore)
export class BrandsAdminController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @RequirePermissions('brand:read')
  @ApiOperation({ summary: 'List brands of every status, offset-paginated' })
  async list(@Query() query: BrandAdminQueryDto) {
    const result = await this.brands.listAdmin({
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
  @RequirePermissions('brand:read')
  @ApiOperation({ summary: 'One brand by id' })
  async findOne(@Param('id') id: string): Promise<BrandAdminDetail> {
    return this.brands.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('brand:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.brands.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('brand:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Brand' })
  @ApiOperation({ summary: 'Create a brand' })
  async create(@Body() dto: BrandCreateDto): Promise<BrandAdminDetail> {
    return this.brands.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('brand:write')
  @ApiOperation({ summary: 'Update a brand. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: BrandUpdateDto): Promise<BrandAdminDetail> {
    return this.brands.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('brand:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<BrandAdminDetail> {
    await this.brands.publish(id, new Date());
    return this.brands.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('brand:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<BrandAdminDetail> {
    await this.brands.unpublish(id);
    return this.brands.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('brand:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<BrandAdminDetail> {
    await this.brands.archive(id);
    return this.brands.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('brand:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<BrandAdminDetail> {
    await this.brands.schedule(id, dto.publishAt, new Date());
    return this.brands.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('brand:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<BrandAdminDetail> {
    await this.brands.restore(id);
    return this.brands.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('brand:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.brands.remove(id);
  }
}
