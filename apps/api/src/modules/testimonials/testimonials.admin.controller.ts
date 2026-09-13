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

import type { TestimonialAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { TestimonialAdminQueryDto, TestimonialCreateDto, TestimonialUpdateDto } from './dto/testimonial.dto';
import { TestimonialsService } from './testimonials.service';

@ApiTags('admin: testimonials')
@ApiBearerAuth()
@Controller('admin/testimonials')
@CacheControl(CACHE_POLICIES.noStore)
export class TestimonialsAdminController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  @RequirePermissions('testimonial:read')
  @ApiOperation({ summary: 'List testimonials of every status, offset-paginated' })
  async list(@Query() query: TestimonialAdminQueryDto) {
    const result = await this.testimonials.listAdmin({
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
  @RequirePermissions('testimonial:read')
  @ApiOperation({ summary: 'One testimonial by id' })
  async findOne(@Param('id') id: string): Promise<TestimonialAdminDetail> {
    return this.testimonials.findAdminById(id);
  }

  @Patch('reorder')
  @RequirePermissions('testimonial:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.testimonials.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('testimonial:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Testimonial' })
  @ApiOperation({ summary: 'Create a testimonial' })
  async create(@Body() dto: TestimonialCreateDto): Promise<TestimonialAdminDetail> {
    return this.testimonials.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('testimonial:write')
  @ApiOperation({ summary: 'Update a testimonial. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: TestimonialUpdateDto,
  ): Promise<TestimonialAdminDetail> {
    return this.testimonials.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('testimonial:publish')
  @ApiOperation({ summary: 'Publish' })
  async publish(@Param('id') id: string): Promise<TestimonialAdminDetail> {
    await this.testimonials.publish(id, new Date());
    return this.testimonials.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('testimonial:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<TestimonialAdminDetail> {
    await this.testimonials.unpublish(id);
    return this.testimonials.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('testimonial:publish')
  @ApiOperation({ summary: 'Archive' })
  async archive(@Param('id') id: string): Promise<TestimonialAdminDetail> {
    await this.testimonials.archive(id);
    return this.testimonials.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('testimonial:publish')
  @ApiOperation({ summary: 'Schedule a publish' })
  async schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleDto,
  ): Promise<TestimonialAdminDetail> {
    await this.testimonials.schedule(id, dto.publishAt, new Date());
    return this.testimonials.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('testimonial:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<TestimonialAdminDetail> {
    await this.testimonials.restore(id);
    return this.testimonials.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('testimonial:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.testimonials.remove(id);
  }
}
