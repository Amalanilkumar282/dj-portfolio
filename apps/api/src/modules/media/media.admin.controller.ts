import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { MediaAssetAdminDetail, MediaUploadSignatureResult } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import { Audited, CacheControl, CACHE_POLICIES, Idempotent, RequirePermissions } from '../../common/decorators';

import { MediaAdminListQueryDto, MediaConfirmDto, MediaUpdateDto, MediaUploadSignatureDto } from './dto/media.dto';
import { MediaService } from './media.service';

/**
 * Admin media pipeline.
 *
 * `media:read`/`media:write`/`media:delete` — there is no `media:publish`,
 * because `MediaAsset` has no publish workflow. See NON_PUBLISHABLE in the
 * RBAC seed.
 */
@ApiTags('admin: media')
@ApiBearerAuth()
@Controller('admin/media')
@CacheControl(CACHE_POLICIES.noStore)
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  @Post('upload-signature')
  @RequirePermissions('media:write')
  @ApiOperation({ summary: 'Get a signed, server-decided destination for a direct browser upload' })
  createUploadSignature(@Body() dto: MediaUploadSignatureDto): MediaUploadSignatureResult {
    return this.media.createUploadSignature(dto);
  }

  @Post()
  @RequirePermissions('media:write')
  @Idempotent()
  @Audited({ action: AuditAction.MEDIA_UPLOAD, entityType: 'MediaAsset' })
  @ApiOperation({
    summary: 'Confirm an upload',
    description:
      'Re-reads authoritative metadata from the Cloudinary Admin API rather than trusting what the ' +
      'client reports — see docs/02-architecture/media-pipeline.md.',
  })
  async confirm(@Body() dto: MediaConfirmDto): Promise<MediaAssetAdminDetail> {
    return this.media.confirm(dto);
  }

  @Get()
  @RequirePermissions('media:read')
  @ApiOperation({ summary: 'List media, offset-paginated' })
  async list(@Query() query: MediaAdminListQueryDto) {
    const result = await this.media.listAdmin({
      q: query.q,
      purpose: query.purpose,
      resourceType: query.resourceType,
      trashed: query.trashed,
      sort: [{ field: 'createdAt', direction: 'desc' }],
      page: query.page,
      perPage: query.perPage,
    });

    return {
      data: result.data,
      meta: {
        pagination: {
          mode: 'offset' as const,
          limit: query.perPage,
          page: result.page,
          totalPages: result.totalPages,
          totalCount: result.total,
          hasMore: result.page < result.totalPages,
        },
      },
    };
  }

  @Get(':id')
  @RequirePermissions('media:read')
  @ApiOperation({ summary: 'One media asset by id' })
  async findOne(@Param('id') id: string): Promise<MediaAssetAdminDetail> {
    return this.media.findAdminById(id);
  }

  @Patch(':id')
  @RequirePermissions('media:write')
  @ApiOperation({ summary: 'Update alt text, caption, credit, tags or the focal point' })
  async update(@Param('id') id: string, @Body() dto: MediaUpdateDto): Promise<MediaAssetAdminDetail> {
    return this.media.update(id, dto);
  }

  @Post(':id/restore')
  @RequirePermissions('media:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<MediaAssetAdminDetail> {
    return this.media.restore(id);
  }

  @Delete(':id')
  @RequirePermissions('media:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete. 409 with the referencing content unless force=true.',
    description:
      'Recoverable from the trash for 30 days; only the nightly sweeper hard-deletes, from both the ' +
      'database and Cloudinary. force=true detaches every nullable reference first.',
  })
  async remove(@Param('id') id: string, @Query('force') force?: string): Promise<void> {
    await this.media.remove(id, force === 'true');
  }
}
