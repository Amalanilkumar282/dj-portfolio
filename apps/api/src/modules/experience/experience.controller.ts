import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { ExperienceEntryDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { ExperienceQueryDto } from './dto/experience.dto';
import { ExperienceService } from './experience.service';

@ApiTags('experience')
@Controller('experience')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class ExperienceController {
  constructor(private readonly experience: ExperienceService) {}

  @Get()
  @ApiOperation({ summary: 'List published work-experience entries, for the /about timeline' })
  async list(@Query() query: ExperienceQueryDto): Promise<{
    data: ExperienceEntryDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.experience.listPublic({
      current: query.current,
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
