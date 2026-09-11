import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import type { StaticPageDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { StaticPagesService } from './static-pages.service';

/**
 * No list route: static pages (privacy, terms, cookies, about-page blocks)
 * are referenced by known slugs from `next.config`/route handlers, never
 * browsed. See `docs/02-architecture/backend.md`.
 */
@ApiTags('pages')
@Controller('pages')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class StaticPagesController {
  constructor(private readonly pages: StaticPagesService) {}

  @Get(':slug')
  @ApiParam({ name: 'slug', example: 'privacy' })
  @ApiOperation({ summary: 'One published static page' })
  async findOne(@Param('slug') slug: string): Promise<StaticPageDetail> {
    return this.pages.findPublicBySlug(slug);
  }
}
