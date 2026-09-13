import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { StatDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { StatQueryDto } from './dto/stat.dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'List visible stats, for the animated counters on / and persona pages' })
  async list(@Query() query: StatQueryDto): Promise<{
    data: StatDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.stats.listPublic({
      personaSlug: query.personaSlug,
      visibleOnly: query.visibleOnly,
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
}
