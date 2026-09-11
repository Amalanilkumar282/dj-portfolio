import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { GearItemDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { GearQueryDto } from './dto/gear.dto';
import { GearService } from './gear.service';

@ApiTags('gear')
@Controller('gear')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class GearController {
  constructor(private readonly gear: GearService) {}

  @Get()
  @ApiOperation({ summary: 'List published gear items, for /setup and the technical rider' })
  async list(@Query() query: GearQueryDto): Promise<{
    data: GearItemDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.gear.listPublic({
      category: query.category,
      riderOnly: query.riderOnly,
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
