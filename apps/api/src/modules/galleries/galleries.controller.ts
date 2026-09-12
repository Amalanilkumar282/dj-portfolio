import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { GalleryDetail, GallerySummary } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, Public } from '../../common/decorators';
import { ERROR_CODES } from '../../common/problems';

import { GalleryQueryDto } from './dto/gallery.dto';
import { GalleriesService } from './galleries.service';

@ApiTags('galleries')
@Controller('galleries')
@Public()
@CacheControl(CACHE_POLICIES.publicContent)
export class GalleriesController {
  constructor(private readonly galleries: GalleriesService) {}

  @Get()
  @ApiOperation({ summary: 'List published galleries' })
  async list(@Query() query: GalleryQueryDto): Promise<{
    data: GallerySummary[];
    meta: {
      pagination: { mode: 'cursor'; limit: number; nextCursor: string | null; hasMore: boolean };
      sort: string;
    };
  }> {
    const result = await this.galleries.listPublic({
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

  @Get(':slug')
  @ApiOperation({ summary: 'One published gallery, with its items' })
  async findOne(@Param('slug') slug: string): Promise<GalleryDetail> {
    const gallery = await this.galleries.findPublicBySlug(slug);
    if (!gallery) {
      throw new NotFoundException({
        message: `No gallery exists with slug "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return gallery;
  }
}
