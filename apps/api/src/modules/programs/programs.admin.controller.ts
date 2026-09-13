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

import type { ProgramAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { ProgramAdminQueryDto, ProgramCreateDto, ProgramUpdateDto } from './dto/program.dto';
import { ProgramsService } from './programs.service';

@ApiTags('admin: programs')
@ApiBearerAuth()
@Controller('admin/programs')
@CacheControl(CACHE_POLICIES.noStore)
export class ProgramsAdminController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @RequirePermissions('program:read')
  @ApiOperation({ summary: 'List programs of every status, offset-paginated' })
  async list(@Query() query: ProgramAdminQueryDto) {
    const result = await this.programs.listAdmin({
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
  @RequirePermissions('program:read')
  @ApiOperation({ summary: 'One program by id, any status' })
  async findOne(@Param('id') id: string): Promise<ProgramAdminDetail> {
    return this.programs.findAdminById(id);
  }

  /** Must stay above `@Patch(':id')` — see docs/02-architecture/backend.md. */
  @Patch('reorder')
  @RequirePermissions('program:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.programs.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('program:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Program' })
  @ApiOperation({ summary: 'Create a program' })
  async create(@Body() dto: ProgramCreateDto): Promise<ProgramAdminDetail> {
    return this.programs.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('program:write')
  @ApiOperation({ summary: 'Update a program. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: ProgramUpdateDto,
  ): Promise<ProgramAdminDetail> {
    return this.programs.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('program:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<ProgramAdminDetail> {
    await this.programs.publish(id, new Date());
    return this.programs.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('program:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<ProgramAdminDetail> {
    await this.programs.unpublish(id);
    return this.programs.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('program:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<ProgramAdminDetail> {
    await this.programs.archive(id);
    return this.programs.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('program:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<ProgramAdminDetail> {
    await this.programs.schedule(id, dto.publishAt, new Date());
    return this.programs.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('program:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<ProgramAdminDetail> {
    await this.programs.restore(id);
    return this.programs.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('program:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.programs.remove(id);
  }
}
