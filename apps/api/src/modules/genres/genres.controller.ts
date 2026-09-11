import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { GenreDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { GenreQueryDto } from './dto/genre.dto';
import { GenresService } from './genres.service';

/**
 * Public genre reads.
 *
 * A separate file from `genres.admin.controller.ts` on purpose: the whole
 * class carries `@Public()` and the admin class carries the guards, so the
 * security boundary is structural rather than a decorator someone might
 * forget on one route. See docs/02-architecture/backend.md.
 */
@ApiTags('genres')
@Controller('genres')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class GenresController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  @ApiOperation({ summary: 'List genres, for filter controls and chips' })
  async list(@Query() query: GenreQueryDto): Promise<{
    data: GenreDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.genres.listPublic({
      q: query.q,
      inUse: query.inUse,
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

  /**
   * Slugs and last-modified dates for prerendering and the sitemap.
   *
   * **Declared before `:slug`.** Routes match in registration order, so a
   * literal path below a parameterised one is swallowed by it.
   */
  @Get('slugs')
  @CacheControl(CACHE_POLICIES.sitemap)
  @ApiOperation({ summary: 'Genre slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.genres.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'psytrance' })
  @ApiOperation({ summary: 'One genre' })
  async findOne(@Param('slug') slug: string): Promise<GenreDetail> {
    return this.genres.findPublicBySlug(slug);
  }
}
