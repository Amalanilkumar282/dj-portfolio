import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { ReleaseDetail, ReleaseSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { ReleaseQueryDto } from './dto/release.dto';
import { ReleasesService } from './releases.service';

@ApiTags('releases')
@Controller('releases')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  @ApiOperation({ summary: 'List published releases' })
  async list(@Query() query: ReleaseQueryDto): Promise<{
    data: ReleaseSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.releases.listPublic({
      personaSlug: query.personaSlug,
      type: query.type,
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
  @ApiOperation({ summary: 'Published release slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.releases.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'neeye-ep' })
  @ApiOperation({ summary: 'One published release' })
  async findOne(
    @Param('slug') slug: string,
    @Query() query: ReleaseQueryDto,
  ): Promise<ReleaseDetail> {
    return this.releases.findPublicBySlug(slug, query.include);
  }
}
