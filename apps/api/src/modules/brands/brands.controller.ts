import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { BrandSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { BrandsService } from './brands.service';
import { BrandQueryDto } from './dto/brand.dto';

@ApiTags('brands')
@Controller('brands')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'List published brands, for the logo strip' })
  async list(@Query() query: BrandQueryDto): Promise<{
    data: BrandSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.brands.listPublic({
      personaSlug: query.personaSlug,
      featured: query.featured,
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
