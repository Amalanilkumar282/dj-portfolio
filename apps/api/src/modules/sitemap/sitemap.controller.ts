import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { SitemapResponse } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { SitemapService } from './sitemap.service';

@ApiTags('sitemap')
@Controller('sitemap')
@Public()
@CacheControl(CACHE_POLICIES.sitemap)
export class SitemapController {
  constructor(private readonly sitemap: SitemapService) {}

  @Get()
  @ApiOperation({ summary: 'Every published, indexable URL, for the web app’s split sitemaps' })
  async list(): Promise<SitemapResponse> {
    return { data: await this.sitemap.list() };
  }
}
