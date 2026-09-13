import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { TagDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { TagQueryDto } from './dto/tag.dto';
import { TagsService } from './tags.service';

@ApiTags('tags')
@Controller('tags')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'List tags, for the blog filter bar' })
  async list(@Query() query: TagQueryDto): Promise<{ data: TagDetail[] }> {
    return { data: await this.tags.listPublic({ q: query.q, limit: query.limit }) };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'production' })
  @ApiOperation({ summary: 'One tag' })
  async findOne(@Param('slug') slug: string): Promise<TagDetail> {
    return this.tags.findPublicBySlug(slug);
  }
}
