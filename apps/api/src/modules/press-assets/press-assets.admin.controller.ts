import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { PressAssetAdminDetail } from '@dj/contracts';
import { AuditAction, type PersonaKey } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { PressAssetAdminQueryDto, PressAssetCreateDto, PressAssetUpdateDto } from './dto/press-asset.dto';
import { PressAssetsService } from './press-assets.service';
import { PressKitGeneratorService } from './press-kit-generator.service';

@ApiTags('admin: press-kit')
@ApiBearerAuth()
@Controller('admin/press-kit')
@CacheControl(CACHE_POLICIES.noStore)
export class PressAssetsAdminController {
  constructor(
    private readonly pressAssets: PressAssetsService,
    private readonly generator: PressKitGeneratorService,
  ) {}

  @Post('epk/:personaKey/regenerate')
  @RequirePermissions('pressAsset:write')
  @ApiOperation({ summary: 'Regenerate the one-page EPK PDF for a persona and publish it' })
  async regenerateEpk(@Param('personaKey') personaKey: PersonaKey): Promise<PressAssetAdminDetail> {
    return this.generator.regenerateEpk(personaKey);
  }

  @Get()
  @RequirePermissions('pressAsset:read')
  @ApiOperation({ summary: 'List press assets of every status, offset-paginated' })
  async list(@Query() query: PressAssetAdminQueryDto) {
    const result = await this.pressAssets.listAdmin({
      status: query.status,
      sort: [{ field: 'sortIndex', direction: 'asc' }],
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
  @RequirePermissions('pressAsset:read')
  @ApiOperation({ summary: 'One press asset by id' })
  async findOne(@Param('id') id: string): Promise<PressAssetAdminDetail> {
    return this.pressAssets.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('pressAsset:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.pressAssets.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('pressAsset:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'PressAsset' })
  @ApiOperation({ summary: 'Create a press asset' })
  async create(@Body() dto: PressAssetCreateDto): Promise<PressAssetAdminDetail> {
    return this.pressAssets.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('pressAsset:write')
  @ApiOperation({ summary: 'Update a press asset. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: PressAssetUpdateDto,
  ): Promise<PressAssetAdminDetail> {
    return this.pressAssets.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('pressAsset:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<PressAssetAdminDetail> {
    await this.pressAssets.publish(id, new Date());
    return this.pressAssets.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('pressAsset:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<PressAssetAdminDetail> {
    await this.pressAssets.unpublish(id);
    return this.pressAssets.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('pressAsset:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<PressAssetAdminDetail> {
    await this.pressAssets.archive(id);
    return this.pressAssets.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('pressAsset:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<PressAssetAdminDetail> {
    await this.pressAssets.schedule(id, dto.publishAt, new Date());
    return this.pressAssets.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('pressAsset:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<PressAssetAdminDetail> {
    await this.pressAssets.restore(id);
    return this.pressAssets.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('pressAsset:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.pressAssets.remove(id);
  }
}
