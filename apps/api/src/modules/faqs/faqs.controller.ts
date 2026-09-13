import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { FaqDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { FaqQueryDto } from './dto/faq.dto';
import { FaqsService } from './faqs.service';

@ApiTags('faqs')
@Controller('faqs')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class FaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @ApiOperation({ summary: 'List published FAQs, for /faq and per-service accordions' })
  async list(@Query() query: FaqQueryDto): Promise<{
    data: FaqDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.faqs.listPublic({
      category: query.category,
      personaSlug: query.personaSlug,
      serviceSlug: query.serviceSlug,
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
