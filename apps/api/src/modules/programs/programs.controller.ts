import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { ProgramDetail, ProgramSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { ProgramQueryDto } from './dto/program.dto';
import { ProgramsService } from './programs.service';

@ApiTags('programs')
@Controller('programs')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'List published programs' })
  async list(@Query() query: ProgramQueryDto): Promise<{
    data: ProgramSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.programs.listPublic({
      personaSlug: query.personaSlug,
      venueSlug: query.venueSlug,
      ongoing: query.ongoing,
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
  @ApiOperation({ summary: 'Published program slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.programs.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'housefull-sunday' })
  @ApiOperation({ summary: 'One published program' })
  async findOne(
    @Param('slug') slug: string,
    @Query() query: ProgramQueryDto,
  ): Promise<ProgramDetail> {
    return this.programs.findPublicBySlug(slug, query.include);
  }
}
