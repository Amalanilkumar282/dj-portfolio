import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { EventDetail, EventSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { EventQueryDto } from './dto/event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List published events' })
  async list(@Query() query: EventQueryDto): Promise<{
    data: EventSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.events.listPublic({
      when: query.when,
      personaSlug: query.personaSlug,
      venueSlug: query.venueSlug,
      programSlug: query.programSlug,
      kind: query.kind,
      city: query.city,
      year: query.year,
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
  @ApiOperation({ summary: 'Published event slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.events.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'bolly-tech' })
  @ApiOperation({ summary: 'One published event' })
  async findOne(@Param('slug') slug: string, @Query() query: EventQueryDto): Promise<EventDetail> {
    return this.events.findPublicBySlug(slug, query.include);
  }
}
