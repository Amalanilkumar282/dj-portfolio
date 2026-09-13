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

import type { TrackAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { TrackAdminQueryDto, TrackCreateDto, TrackUpdateDto } from './dto/track.dto';
import { TracksService } from './tracks.service';

@ApiTags('admin: tracks')
@ApiBearerAuth()
@Controller('admin/tracks')
@CacheControl(CACHE_POLICIES.noStore)
export class TracksAdminController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  @RequirePermissions('track:read')
  @ApiOperation({ summary: 'List tracks of every status, offset-paginated' })
  async list(@Query() query: TrackAdminQueryDto) {
    const result = await this.tracks.listAdmin({
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
  @RequirePermissions('track:read')
  @ApiOperation({ summary: 'One track by id, any status' })
  async findOne(@Param('id') id: string): Promise<TrackAdminDetail> {
    return this.tracks.findAdminById(id);
  }

  /** Must stay above `@Patch(':id')` — see docs/02-architecture/backend.md. */
  @Patch('reorder')
  @RequirePermissions('track:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.tracks.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('track:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Track' })
  @ApiOperation({ summary: 'Create a track' })
  async create(@Body() dto: TrackCreateDto): Promise<TrackAdminDetail> {
    return this.tracks.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('track:write')
  @ApiOperation({ summary: 'Update a track. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: TrackUpdateDto): Promise<TrackAdminDetail> {
    return this.tracks.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('track:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<TrackAdminDetail> {
    await this.tracks.publish(id, new Date());
    return this.tracks.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('track:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<TrackAdminDetail> {
    await this.tracks.unpublish(id);
    return this.tracks.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('track:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<TrackAdminDetail> {
    await this.tracks.archive(id);
    return this.tracks.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('track:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<TrackAdminDetail> {
    await this.tracks.schedule(id, dto.publishAt, new Date());
    return this.tracks.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('track:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<TrackAdminDetail> {
    await this.tracks.restore(id);
    return this.tracks.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('track:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.tracks.remove(id);
  }
}
