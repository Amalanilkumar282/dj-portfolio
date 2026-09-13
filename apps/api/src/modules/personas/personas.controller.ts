import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { PersonaDetail, PersonaPageResponse, PersonaSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { PersonaQueryDto } from './dto/persona.dto';
import { PersonasService } from './personas.service';

/**
 * Public persona reads.
 *
 * Deliberately a separate file from `personas.admin.controller.ts`. The whole
 * class carries `@Public()`, and the admin class carries the guards — so the
 * security boundary is structural rather than a decorator someone might
 * forget on one route. See docs/02-architecture/backend.md.
 *
 * Reads are by **slug**, not id: slugs are the public identity and ids are an
 * implementation detail nobody outside admin should need.
 */
@ApiTags('personas')
@Controller('personas')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  @Get()
  @ApiOperation({ summary: 'List published personas' })
  async list(@Query() query: PersonaQueryDto): Promise<{
    data: PersonaSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.personas.listPublic({
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

  /**
   * Slugs and last-modified dates for `generateStaticParams` and the sitemap.
   *
   * Declared before `:slug` — Express matches in registration order, so a
   * later literal route would be swallowed by the parameter above it.
   */
  @Get('slugs')
  @CacheControl(CACHE_POLICIES.sitemap)
  @ApiOperation({ summary: 'Published slugs with lastmod, for prerendering and sitemaps' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.personas.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'trinitrocosmic' })
  @ApiOperation({ summary: 'One published persona' })
  async findOne(
    @Param('slug') slug: string,
    @Query() query: PersonaQueryDto,
  ): Promise<PersonaDetail> {
    return this.personas.findPublicBySlug(slug, query.include);
  }

  /**
   * Everything the persona landing page needs, in one response.
   *
   * The backend-for-frontend concession described in
   * docs/02-architecture/backend.md: the alternative is eight round trips per
   * page render. Two queries plus a venue rollup.
   */
  @Get(':slug/page')
  @ApiParam({ name: 'slug', example: 'tnt' })
  @ApiOperation({ summary: 'Aggregate payload for the persona landing page' })
  async page(@Param('slug') slug: string): Promise<PersonaPageResponse> {
    return this.personas.getPageData(slug, new Date());
  }
}
