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

import type { ServiceAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { ServiceAdminQueryDto, ServiceCreateDto, ServiceUpdateDto } from './dto/service.dto';
import { ServicesService } from './services.service';

@ApiTags('admin: services')
@ApiBearerAuth()
@Controller('admin/services')
@CacheControl(CACHE_POLICIES.noStore)
export class ServicesAdminController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @RequirePermissions('service:read')
  @ApiOperation({ summary: 'List services of every status, offset-paginated' })
  async list(@Query() query: ServiceAdminQueryDto) {
    const result = await this.services.listAdmin({
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
  @RequirePermissions('service:read')
  @ApiOperation({ summary: 'One service by id' })
  async findOne(@Param('id') id: string): Promise<ServiceAdminDetail> {
    return this.services.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('service:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.services.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('service:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Service' })
  @ApiOperation({ summary: 'Create a service' })
  async create(@Body() dto: ServiceCreateDto): Promise<ServiceAdminDetail> {
    return this.services.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('service:write')
  @ApiOperation({ summary: 'Update a service. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: ServiceUpdateDto): Promise<ServiceAdminDetail> {
    return this.services.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('service:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<ServiceAdminDetail> {
    await this.services.publish(id, new Date());
    return this.services.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('service:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<ServiceAdminDetail> {
    await this.services.unpublish(id);
    return this.services.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('service:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<ServiceAdminDetail> {
    await this.services.archive(id);
    return this.services.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('service:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<ServiceAdminDetail> {
    await this.services.schedule(id, dto.publishAt, new Date());
    return this.services.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('service:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<ServiceAdminDetail> {
    await this.services.restore(id);
    return this.services.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('service:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.services.remove(id);
  }
}
