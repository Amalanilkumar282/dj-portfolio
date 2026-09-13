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

import type { FaqAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { FaqAdminQueryDto, FaqCreateDto, FaqUpdateDto } from './dto/faq.dto';
import { FaqsService } from './faqs.service';

@ApiTags('admin: faqs')
@ApiBearerAuth()
@Controller('admin/faqs')
@CacheControl(CACHE_POLICIES.noStore)
export class FaqsAdminController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  @RequirePermissions('faq:read')
  @ApiOperation({ summary: 'List FAQs of every status, offset-paginated' })
  async list(@Query() query: FaqAdminQueryDto) {
    const result = await this.faqs.listAdmin({
      status: query.status,
      q: query.q,
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
  @RequirePermissions('faq:read')
  @ApiOperation({ summary: 'One FAQ by id' })
  async findOne(@Param('id') id: string): Promise<FaqAdminDetail> {
    return this.faqs.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('faq:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.faqs.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('faq:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Faq' })
  @ApiOperation({ summary: 'Create a FAQ' })
  async create(@Body() dto: FaqCreateDto): Promise<FaqAdminDetail> {
    return this.faqs.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('faq:write')
  @ApiOperation({ summary: 'Update a FAQ. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: FaqUpdateDto): Promise<FaqAdminDetail> {
    return this.faqs.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('faq:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<FaqAdminDetail> {
    await this.faqs.publish(id, new Date());
    return this.faqs.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('faq:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<FaqAdminDetail> {
    await this.faqs.unpublish(id);
    return this.faqs.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('faq:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<FaqAdminDetail> {
    await this.faqs.archive(id);
    return this.faqs.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('faq:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<FaqAdminDetail> {
    await this.faqs.schedule(id, dto.publishAt, new Date());
    return this.faqs.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('faq:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<FaqAdminDetail> {
    await this.faqs.restore(id);
    return this.faqs.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('faq:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.faqs.remove(id);
  }
}
