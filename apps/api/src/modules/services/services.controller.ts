import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { ServiceDetail, ServiceSummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { ServiceQueryDto } from './dto/service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List published services, for /services' })
  async list(@Query() query: ServiceQueryDto): Promise<{
    data: ServiceSummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.services.listPublic({
      category: query.category,
      personaSlug: query.personaSlug,
      featured: query.featured,
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

  @Get('slugs')
  @CacheControl(CACHE_POLICIES.sitemap)
  @ApiOperation({ summary: 'Published service slugs with lastmod' })
  async slugs(): Promise<{ data: { slug: string; updatedAt: Date }[] }> {
    return { data: await this.services.listSlugs() };
  }

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'wedding-sangeet-package' })
  @ApiOperation({ summary: 'One published service' })
  async findOne(
    @Param('slug') slug: string,
    @Query() query: ServiceQueryDto,
  ): Promise<ServiceDetail> {
    return this.services.findPublicBySlug(slug, query.include);
  }
}
