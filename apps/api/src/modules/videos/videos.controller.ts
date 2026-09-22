import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { VideoDetail, VideoSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';
import { ERROR_CODES } from '../../common/problems';

import { VideoQueryDto } from './dto/video.dto';
import { VideosService } from './videos.service';

@ApiTags('videos')
@Controller('videos')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'List published videos' })
  async list(@Query() query: VideoQueryDto): Promise<{
    data: VideoSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.videos.listPublic({
      personaSlug: query.personaSlug,
      eventSlug: query.eventSlug,
      featured: query.featured,
      q: query.q,
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
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
  @ApiOperation({ summary: 'Published video slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.videos.listSlugs() };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One published video' })
  async findOne(@Param('slug') slug: string): Promise<VideoDetail> {
    const video = await this.videos.findPublicBySlug(slug);
    if (!video) {
      throw new NotFoundException({
        message: `No video exists with slug "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return video;
  }
}
