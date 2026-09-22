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

import type { VideoAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { VideoAdminQueryDto, VideoCreateDto, VideoUpdateDto } from './dto/video.dto';
import { VideosService } from './videos.service';

@ApiTags('admin: videos')
@ApiBearerAuth()
@Controller('admin/videos')
@CacheControl(CACHE_POLICIES.noStore)
export class VideosAdminController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  @RequirePermissions('video:read')
  @ApiOperation({ summary: 'List videos of every status, offset-paginated' })
  async list(@Query() query: VideoAdminQueryDto) {
    const result = await this.videos.listAdmin({
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
  @RequirePermissions('video:read')
  @ApiOperation({ summary: 'One video by id' })
  async findOne(@Param('id') id: string): Promise<VideoAdminDetail> {
    return this.videos.findAdminById(id);
  }

  /** Above `:id` — declared the other way round, this route is swallowed. */
  @Patch('reorder')
  @RequirePermissions('video:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.videos.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('video:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Video' })
  @ApiOperation({ summary: 'Create a video' })
  async create(@Body() dto: VideoCreateDto): Promise<VideoAdminDetail> {
    return this.videos.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('video:write')
  @ApiOperation({ summary: 'Update a video. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: VideoUpdateDto): Promise<VideoAdminDetail> {
    return this.videos.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('video:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<VideoAdminDetail> {
    await this.videos.publish(id, new Date());
    return this.videos.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('video:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<VideoAdminDetail> {
    await this.videos.unpublish(id);
    return this.videos.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('video:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<VideoAdminDetail> {
    await this.videos.archive(id);
    return this.videos.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('video:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<VideoAdminDetail> {
    await this.videos.schedule(id, dto.publishAt, new Date());
    return this.videos.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('video:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<VideoAdminDetail> {
    await this.videos.restore(id);
    return this.videos.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('video:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.videos.remove(id);
  }
}
