import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { BookingInquiryAdminDetail } from '@dj/contracts';

import { CacheControl, CACHE_POLICIES, RequirePermissions } from '../../common/decorators';

import { InquiryAdminQueryDto, InquiryNoteCreateDto, InquiryUpdateDto } from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('admin: inquiries')
@ApiBearerAuth()
@Controller('admin/inquiries')
@CacheControl(CACHE_POLICIES.noStore)
export class InquiriesAdminController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  @RequirePermissions('inquiry:read')
  @ApiOperation({ summary: 'List inquiries, offset-paginated — the Kanban pipeline data source' })
  async list(@Query() query: InquiryAdminQueryDto) {
    const result = await this.inquiries.listAdmin({
      status: query.status,
      q: query.q,
      assignedToId: query.assignedToId,
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

  @Get(':id')
  @RequirePermissions('inquiry:read')
  @ApiOperation({ summary: 'One inquiry by id, with notes' })
  async findOne(@Param('id') id: string): Promise<BookingInquiryAdminDetail> {
    return this.inquiries.findAdminById(id);
  }

  @Patch(':id')
  @RequirePermissions('inquiry:write')
  @ApiOperation({ summary: 'Move through the pipeline, assign, quote' })
  async update(
    @Param('id') id: string,
    @Body() dto: InquiryUpdateDto,
  ): Promise<BookingInquiryAdminDetail> {
    return this.inquiries.update(id, dto);
  }

  @Post(':id/notes')
  @RequirePermissions('inquiry:write')
  @ApiOperation({ summary: 'Append an admin note. Notes are append-only.' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: InquiryNoteCreateDto,
  ): Promise<BookingInquiryAdminDetail> {
    return this.inquiries.addNote(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('inquiry:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.inquiries.remove(id);
  }
}
