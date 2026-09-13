import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { VenueDetail, VenueSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { VenueQueryDto } from './dto/venue.dto';
import { VenuesService } from './venues.service';

/**
 * Public venue reads.
 *
 * A separate file from `venues.admin.controller.ts` on purpose: the whole
 * class carries `@Public()` and the admin class carries the guards, so the
 * security boundary is structural rather than a decorator someone might
 * forget on one route. See docs/02-architecture/backend.md.
 *
 * Reads are by **slug**, not id: slugs are the public identity and ids are
 * an implementation detail nobody outside admin should need.
 */
@ApiTags('venues')
@Controller('venues')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'List published venues' })
  async list(@Query() query: VenueQueryDto): Promise<{
    data: VenueSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.venues.listPublic({
      city: query.city,
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

  /**
   * Slugs and last-modified dates for `generateStaticParams` and the sitemap.
   *
   * Declared before `:slug` — Express matches in registration order, so a
   * later literal route would be swallowed by the parameter above it.
   */
  @Get('slugs')
  @CacheControl(CACHE_POLICIES.sitemap)
  @ApiOperation({ summary: 'Published venue slugs with lastmod, for prerendering and sitemaps' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.venues.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'big-pitcher-sarjapur' })
  @ApiOperation({ summary: 'One published venue' })
  async findOne(@Param('slug') slug: string, @Query() query: VenueQueryDto): Promise<VenueDetail> {
    return this.venues.findPublicBySlug(slug, query.include);
  }
}
