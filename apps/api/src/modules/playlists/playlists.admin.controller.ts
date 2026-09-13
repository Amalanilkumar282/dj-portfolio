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

import type { PlaylistAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { PlaylistAdminQueryDto, PlaylistCreateDto, PlaylistUpdateDto } from './dto/playlist.dto';
import { PlaylistsService } from './playlists.service';

@ApiTags('admin: playlists')
@ApiBearerAuth()
@Controller('admin/playlists')
@CacheControl(CACHE_POLICIES.noStore)
export class PlaylistsAdminController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Get()
  @RequirePermissions('playlist:read')
  @ApiOperation({ summary: 'List playlists of every status, offset-paginated' })
  async list(@Query() query: PlaylistAdminQueryDto) {
    const result = await this.playlists.listAdmin({
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
  @RequirePermissions('playlist:read')
  @ApiOperation({ summary: 'One playlist by id, any status' })
  async findOne(@Param('id') id: string): Promise<PlaylistAdminDetail> {
    return this.playlists.findAdminById(id);
  }

  /** Must stay above `@Patch(':id')` — see docs/02-architecture/backend.md. */
  @Patch('reorder')
  @RequirePermissions('playlist:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.playlists.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('playlist:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Playlist' })
  @ApiOperation({ summary: 'Create a playlist' })
  async create(@Body() dto: PlaylistCreateDto): Promise<PlaylistAdminDetail> {
    return this.playlists.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('playlist:write')
  @ApiOperation({
    summary: 'Update a playlist. Unmentioned fields are untouched.',
    description:
      'Sending trackIds replaces the ordered track list wholesale, and recomputes totalDurationSec.',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: PlaylistUpdateDto,
  ): Promise<PlaylistAdminDetail> {
    return this.playlists.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('playlist:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<PlaylistAdminDetail> {
    await this.playlists.publish(id, new Date());
    return this.playlists.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('playlist:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<PlaylistAdminDetail> {
    await this.playlists.unpublish(id);
    return this.playlists.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('playlist:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<PlaylistAdminDetail> {
    await this.playlists.archive(id);
    return this.playlists.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('playlist:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<PlaylistAdminDetail> {
    await this.playlists.schedule(id, dto.publishAt, new Date());
    return this.playlists.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('playlist:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<PlaylistAdminDetail> {
    await this.playlists.restore(id);
    return this.playlists.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('playlist:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.playlists.remove(id);
  }
}
