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

import type { PostAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { PostAdminQueryDto, PostCreateDto, PostUpdateDto } from './dto/post.dto';
import { PostsService } from './posts.service';

@ApiTags('admin: posts')
@ApiBearerAuth()
@Controller('admin/posts')
@CacheControl(CACHE_POLICIES.noStore)
export class PostsAdminController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @RequirePermissions('post:read')
  @ApiOperation({ summary: 'List posts of every status, offset-paginated' })
  async list(@Query() query: PostAdminQueryDto) {
    const result = await this.posts.listAdmin({
      status: query.status,
      q: query.q,
      sort: [{ field: 'createdAt', direction: 'desc' }],
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
  @RequirePermissions('post:read')
  @ApiOperation({ summary: 'One post by id' })
  async findOne(@Param('id') id: string): Promise<PostAdminDetail> {
    return this.posts.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('post:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.posts.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('post:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Post' })
  @ApiOperation({ summary: 'Create a post' })
  async create(@Body() dto: PostCreateDto): Promise<PostAdminDetail> {
    return this.posts.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('post:write')
  @ApiOperation({ summary: 'Update a post. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: PostUpdateDto): Promise<PostAdminDetail> {
    return this.posts.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('post:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<PostAdminDetail> {
    await this.posts.publish(id, new Date());
    return this.posts.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('post:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<PostAdminDetail> {
    await this.posts.unpublish(id);
    return this.posts.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('post:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<PostAdminDetail> {
    await this.posts.archive(id);
    return this.posts.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('post:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<PostAdminDetail> {
    await this.posts.schedule(id, dto.publishAt, new Date());
    return this.posts.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('post:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<PostAdminDetail> {
    await this.posts.restore(id);
    return this.posts.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('post:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.posts.remove(id);
  }
}
