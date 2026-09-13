import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CacheControl, CACHE_POLICIES, RequirePermissions } from '../../common/decorators';

import { NewsletterAdminQueryDto } from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

@ApiTags('admin: newsletter')
@ApiBearerAuth()
@Controller('admin/newsletter')
@CacheControl(CACHE_POLICIES.noStore)
export class NewsletterAdminController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @RequirePermissions('newsletter:read')
  @ApiOperation({ summary: 'List subscribers, offset-paginated' })
  async list(@Query() query: NewsletterAdminQueryDto) {
    const result = await this.newsletter.listAdmin({
      status: query.status,
      q: query.q,
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    });

    return {
      data: result.data,
      meta: {
        pagination: {
          mode: 'offset' as const,
          limit: query.perPage ?? 25,
          page: result.page,
          totalPages: result.totalPages,
          totalCount: result.total,
          hasMore: result.page < result.totalPages,
        },
      },
    };
  }
}
