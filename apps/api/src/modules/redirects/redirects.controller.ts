import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { RedirectDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { RedirectsService } from './redirects.service';

/**
 * Every active redirect, unpaginated. Consumed once by the web middleware
 * and cached there for an hour — a paginated shape would make it build the
 * full map through N round trips for no benefit.
 */
@ApiTags('redirects')
@Controller('redirects')
@Public()
@CacheControl(CACHE_POLICIES.publicSlow)
export class RedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @ApiOperation({ summary: 'All active redirects, for the web middleware' })
  async list(): Promise<{ data: RedirectDetail[] }> {
    return { data: await this.redirects.listActive() };
  }
}
