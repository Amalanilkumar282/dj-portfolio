import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { PressAssetDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';

import { PressAssetDownloadDto, PressAssetQueryDto } from './dto/press-asset.dto';
import { PressAssetsService } from './press-assets.service';

@ApiTags('press-kit')
@Controller('press-kit')
@Public()
export class PressAssetsController {
  constructor(private readonly pressAssets: PressAssetsService) {}

  @Get()
  @CacheControl(CACHE_POLICIES.publicContent)
  @ApiOperation({ summary: 'List published press assets' })
  async list(@Query() query: PressAssetQueryDto): Promise<{
    data: PressAssetDetail[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.pressAssets.listPublic({
      kind: query.kind,
      personaSlug: query.personaSlug,
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

  @Post(':id/download')
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  @CacheControl(CACHE_POLICIES.noStore)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a signed, expiring download URL. Emails required for gated assets.' })
  async download(
    @Param('id') id: string,
    @Body() dto: PressAssetDownloadDto,
  ): Promise<{ downloadUrl: string }> {
    return this.pressAssets.requestDownload(id, dto);
  }
}
