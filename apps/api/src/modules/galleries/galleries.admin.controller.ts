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

import type { GalleryAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { GalleryAdminQueryDto, GalleryCreateDto, GalleryUpdateDto } from './dto/gallery.dto';
import { GalleriesService } from './galleries.service';

@ApiTags('admin: galleries')
@ApiBearerAuth()
@Controller('admin/galleries')
@CacheControl(CACHE_POLICIES.noStore)
export class GalleriesAdminController {
  constructor(private readonly galleries: GalleriesService) {}

  @Get()
  @RequirePermissions('gallery:read')
  @ApiOperation({ summary: 'List galleries of every status, offset-paginated' })
  async list(@Query() query: GalleryAdminQueryDto) {
    const result = await this.galleries.listAdmin({
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
  @RequirePermissions('gallery:read')
  @ApiOperation({ summary: 'One gallery by id, including its items' })
  async findOne(@Param('id') id: string): Promise<GalleryAdminDetail> {
    return this.galleries.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('gallery:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.galleries.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('gallery:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Gallery' })
  @ApiOperation({ summary: 'Create a gallery' })
  async create(@Body() dto: GalleryCreateDto): Promise<GalleryAdminDetail> {
    return this.galleries.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('gallery:write')
  @ApiOperation({ summary: 'Update a gallery. Unmentioned fields are untouched; `items` if present replaces the whole list.' })
  async update(@Param('id') id: string, @Body() dto: GalleryUpdateDto): Promise<GalleryAdminDetail> {
    return this.galleries.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('gallery:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<GalleryAdminDetail> {
    await this.galleries.publish(id, new Date());
    return this.galleries.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('gallery:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<GalleryAdminDetail> {
    await this.galleries.unpublish(id);
    return this.galleries.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('gallery:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<GalleryAdminDetail> {
    await this.galleries.archive(id);
    return this.galleries.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('gallery:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<GalleryAdminDetail> {
    await this.galleries.schedule(id, dto.publishAt, new Date());
    return this.galleries.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('gallery:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<GalleryAdminDetail> {
    await this.galleries.restore(id);
    return this.galleries.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('gallery:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.galleries.remove(id);
  }
}
