import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { TagAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import { Audited, CacheControl, CACHE_POLICIES, Idempotent, RequirePermissions } from '../../common/decorators';

import { TagCreateDto, TagQueryDto, TagUpdateDto } from './dto/tag.dto';
import { TagsService } from './tags.service';

/** No publish workflow: `Tag` has no `status` column. */
@ApiTags('admin: tags')
@ApiBearerAuth()
@Controller('admin/tags')
@CacheControl(CACHE_POLICIES.noStore)
export class TagsAdminController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermissions('tag:read')
  @ApiOperation({ summary: 'List tags with post counts' })
  async list(@Query() query: TagQueryDto): Promise<{ data: TagAdminDetail[] }> {
    return { data: await this.tags.listAdmin({ q: query.q, limit: query.limit }) };
  }

  @Post()
  @RequirePermissions('tag:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Tag' })
  @ApiOperation({ summary: 'Create a tag' })
  async create(@Body() dto: TagCreateDto): Promise<TagAdminDetail> {
    return this.tags.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('tag:write')
  @ApiOperation({ summary: 'Update a tag. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: TagUpdateDto): Promise<TagAdminDetail> {
    return this.tags.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tag:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a tag. 409 with the post count if it is still in use.',
    description: 'A real delete — Tag has no deletedAt, and PostTag cascades.',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.tags.remove(id);
  }
}
