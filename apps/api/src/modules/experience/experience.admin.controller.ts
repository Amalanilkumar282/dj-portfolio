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

import type { ExperienceEntryAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { ExperienceAdminQueryDto, ExperienceCreateDto, ExperienceUpdateDto } from './dto/experience.dto';
import { ExperienceService } from './experience.service';

@ApiTags('admin: experience')
@ApiBearerAuth()
@Controller('admin/experience')
@CacheControl(CACHE_POLICIES.noStore)
export class ExperienceAdminController {
  constructor(private readonly experience: ExperienceService) {}

  @Get()
  @RequirePermissions('experience:read')
  @ApiOperation({ summary: 'List experience entries of every status, offset-paginated' })
  async list(@Query() query: ExperienceAdminQueryDto) {
    const result = await this.experience.listAdmin({
      status: query.status,
      q: query.q,
      sort: [{ field: 'startDate', direction: 'desc' }],
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
  @RequirePermissions('experience:read')
  @ApiOperation({ summary: 'One experience entry by id' })
  async findOne(@Param('id') id: string): Promise<ExperienceEntryAdminDetail> {
    return this.experience.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('experience:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.experience.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('experience:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'ExperienceEntry' })
  @ApiOperation({ summary: 'Create an experience entry' })
  async create(@Body() dto: ExperienceCreateDto): Promise<ExperienceEntryAdminDetail> {
    return this.experience.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('experience:write')
  @ApiOperation({ summary: 'Update an experience entry. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: ExperienceUpdateDto,
  ): Promise<ExperienceEntryAdminDetail> {
    return this.experience.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('experience:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<ExperienceEntryAdminDetail> {
    await this.experience.publish(id, new Date());
    return this.experience.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('experience:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<ExperienceEntryAdminDetail> {
    await this.experience.unpublish(id);
    return this.experience.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('experience:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<ExperienceEntryAdminDetail> {
    await this.experience.archive(id);
    return this.experience.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('experience:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleDto,
  ): Promise<ExperienceEntryAdminDetail> {
    await this.experience.schedule(id, dto.publishAt, new Date());
    return this.experience.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('experience:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<ExperienceEntryAdminDetail> {
    await this.experience.restore(id);
    return this.experience.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('experience:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.experience.remove(id);
  }
}
