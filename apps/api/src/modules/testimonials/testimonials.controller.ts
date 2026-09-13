import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { TestimonialDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { TestimonialQueryDto } from './dto/testimonial.dto';
import { TestimonialsService } from './testimonials.service';

@ApiTags('testimonials')
@Controller('testimonials')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class TestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @ApiOperation({ summary: 'List published testimonials, for /testimonials and persona pages' })
  async list(@Query() query: TestimonialQueryDto): Promise<{
    data: TestimonialDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.testimonials.listPublic({
      personaSlug: query.personaSlug,
      featured: query.featured,
      verifiedOnly: query.verifiedOnly,
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
