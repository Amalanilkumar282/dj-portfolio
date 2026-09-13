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

import type { EventAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { EventAdminQueryDto, EventCreateDto, EventUpdateDto } from './dto/event.dto';
import { EventsService } from './events.service';

@ApiTags('admin: events')
@ApiBearerAuth()
@Controller('admin/events')
@CacheControl(CACHE_POLICIES.noStore)
export class EventsAdminController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @RequirePermissions('event:read')
  @ApiOperation({ summary: 'List events of every status, offset-paginated' })
  async list(@Query() query: EventAdminQueryDto) {
    const result = await this.events.listAdmin({
      status: query.status,
      personaSlug: query.personaSlug,
      when: query.when,
      q: query.q,
      sort: [{ field: 'startsAt', direction: 'desc' }],
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
  @RequirePermissions('event:read')
  @ApiOperation({ summary: 'One event by id, any status' })
  async findOne(@Param('id') id: string): Promise<EventAdminDetail> {
    return this.events.findAdminById(id);
  }

  /** Must stay above `@Patch(':id')` — see docs/02-architecture/backend.md. */
  @Patch('reorder')
  @RequirePermissions('event:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.events.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('event:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Event' })
  @ApiOperation({ summary: 'Create an event' })
  async create(@Body() dto: EventCreateDto): Promise<EventAdminDetail> {
    return this.events.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('event:write')
  @ApiOperation({
    summary: 'Update an event. Unmentioned fields are untouched.',
    description:
      'Sending lineup replaces the lineup wholesale. isPast is not settable here — ' +
      'the hourly cron is the single writer of that field.',
  })
  async update(@Param('id') id: string, @Body() dto: EventUpdateDto): Promise<EventAdminDetail> {
    return this.events.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  @RequirePermissions('event:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<EventAdminDetail> {
    await this.events.publish(id, new Date());
    return this.events.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('event:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<EventAdminDetail> {
    await this.events.unpublish(id);
    return this.events.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('event:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<EventAdminDetail> {
    await this.events.archive(id);
    return this.events.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('event:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<EventAdminDetail> {
    await this.events.schedule(id, dto.publishAt, new Date());
    return this.events.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('event:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<EventAdminDetail> {
    await this.events.restore(id);
    return this.events.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('event:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.events.remove(id);
  }
}
