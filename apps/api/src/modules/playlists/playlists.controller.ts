import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { PlaylistDetail, PlaylistSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { PlaylistQueryDto } from './dto/playlist.dto';
import { PlaylistsService } from './playlists.service';

@ApiTags('playlists')
@Controller('playlists')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class PlaylistsController {
  constructor(private readonly playlists: PlaylistsService) {}

  @Get()
  @ApiOperation({ summary: 'List published playlists' })
  async list(@Query() query: PlaylistQueryDto): Promise<{
    data: PlaylistSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.playlists.listPublic({
      personaSlug: query.personaSlug,
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

  /** Declared before `:slug` — a later literal route would be swallowed. */
  @Get('slugs')
  @CacheControl(CACHE_POLICIES.sitemap)
  @ApiOperation({ summary: 'Published playlist slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.playlists.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'techno-essentials' })
  @ApiOperation({ summary: 'One published playlist' })
  async findOne(
    @Param('slug') slug: string,
    @Query() query: PlaylistQueryDto,
  ): Promise<PlaylistDetail> {
    return this.playlists.findPublicBySlug(slug, query.include);
  }
}
