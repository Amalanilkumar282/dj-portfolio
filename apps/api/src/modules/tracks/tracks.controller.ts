import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { TrackDetail, TrackSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { TrackQueryDto } from './dto/track.dto';
import { TracksService } from './tracks.service';

@ApiTags('tracks')
@Controller('tracks')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  @ApiOperation({ summary: 'List published tracks' })
  async list(@Query() query: TrackQueryDto): Promise<{
    data: TrackSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.tracks.listPublic({
      personaSlug: query.personaSlug,
      type: query.type,
      genreSlug: query.genreSlug,
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
  @ApiOperation({ summary: 'Published track slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.tracks.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'bolly-tech-mix' })
  @ApiOperation({ summary: 'One published track' })
  async findOne(@Param('slug') slug: string, @Query() query: TrackQueryDto): Promise<TrackDetail> {
    return this.tracks.findPublicBySlug(slug, query.include);
  }
}
