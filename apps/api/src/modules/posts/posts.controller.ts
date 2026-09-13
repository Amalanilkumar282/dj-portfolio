import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { PostDetail, PostSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { PostQueryDto } from './dto/post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'List published posts, for /blog' })
  async list(@Query() query: PostQueryDto): Promise<{
    data: PostSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.posts.listPublic({
      personaSlug: query.personaSlug,
      tagSlug: query.tagSlug,
      featured: query.featured,
      q: query.q,
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
      include: query.include,
    });

    return {
      data: result.data,
      meta: {
        pagination: {
          mode: 'cursor',
          limit: query.limit,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
        sort: query.sort.map((s) => `${s.direction === 'desc' ? '-' : ''}${s.field}`).join(','),
      },
    };
  }

  @Get('slugs')
  @CacheControl(CACHE_POLICIES.sitemap)
  @ApiOperation({ summary: 'Published post slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.posts.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'behind-the-decks-tnt' })
  @ApiOperation({ summary: 'One published post' })
  async findOne(@Param('slug') slug: string, @Query() query: PostQueryDto): Promise<PostDetail> {
    return this.posts.findPublicBySlug(slug, query.include);
  }
}
