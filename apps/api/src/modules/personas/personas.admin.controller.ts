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

import type { PersonaAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto, ScheduleDto } from '../../common/dto/content.dto';

import { PersonaAdminQueryDto, PersonaCreateDto, PersonaUpdateDto } from './dto/persona.dto';
import { PersonasService } from './personas.service';

/**
 * Admin persona writes.
 *
 * The class-level decorators are the security boundary: every route here is
 * authenticated (the global `JwtAccessGuard` denies by default and nothing
 * opts out), permission-checked, and `no-store`.
 *
 * Writes are by **id**, not slug. Slugs change; ids do not, so an admin form
 * holding an id keeps working after a rename.
 *
 * See docs/02-architecture/backend.md
 */
@ApiTags('admin: personas')
@ApiBearerAuth()
@Controller('admin/personas')
@CacheControl(CACHE_POLICIES.noStore)
export class PersonasAdminController {
  constructor(private readonly personas: PersonasService) {}

  @Get()
  @RequirePermissions('persona:read')
  @ApiOperation({ summary: 'List personas of every status, offset-paginated' })
  async list(@Query() query: PersonaAdminQueryDto) {
    const result = await this.personas.listAdmin({
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
  @RequirePermissions('persona:read')
  @ApiOperation({ summary: 'One persona by id, any status' })
  async findOne(@Param('id') id: string): Promise<PersonaAdminDetail> {
    return this.personas.findAdminById(id);
  }

  /**
   * Bulk reorder.
   *
   * **Must stay above `@Patch(':id')`.** Routes match in declaration order, so
   * a `:id` route declared first swallows `/reorder` and tries to update a
   * persona whose id is the literal string "reorder" — a 404 that looks like
   * a missing record rather than a routing mistake.
   *
   * Taken as one call because drag-and-drop produces a whole permutation:
   * twenty separate PATCHes would be twenty round trips and could leave the
   * list half-reordered.
   */
  @Patch('reorder')
  @RequirePermissions('persona:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.personas.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('persona:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Persona' })
  @ApiOperation({ summary: 'Create a persona' })
  async create(@Body() dto: PersonaCreateDto): Promise<PersonaAdminDetail> {
    return this.personas.create(dto, new Date());
  }

  @Patch(':id')
  @RequirePermissions('persona:write')
  @ApiOperation({ summary: 'Update a persona. Unmentioned fields are untouched.' })
  async update(
    @Param('id') id: string,
    @Body() dto: PersonaUpdateDto,
  ): Promise<PersonaAdminDetail> {
    return this.personas.update(id, dto, new Date());
  }

  @Patch(':id/publish')
  // Separate from `persona:write` on purpose: an editor may draft freely
  // while only an owner decides what goes live.
  @RequirePermissions('persona:publish')
  @ApiOperation({ summary: 'Publish, and revalidate the public page' })
  async publish(@Param('id') id: string): Promise<PersonaAdminDetail> {
    await this.personas.publish(id, new Date());
    return this.personas.findAdminById(id);
  }

  @Patch(':id/unpublish')
  @RequirePermissions('persona:publish')
  @ApiOperation({ summary: 'Return to draft' })
  async unpublish(@Param('id') id: string): Promise<PersonaAdminDetail> {
    await this.personas.unpublish(id);
    return this.personas.findAdminById(id);
  }

  @Patch(':id/archive')
  @RequirePermissions('persona:publish')
  @ApiOperation({ summary: 'Archive, removing it from the site but keeping it in the CMS' })
  async archive(@Param('id') id: string): Promise<PersonaAdminDetail> {
    await this.personas.archive(id);
    return this.personas.findAdminById(id);
  }

  @Patch(':id/schedule')
  @RequirePermissions('persona:publish')
  @ApiOperation({ summary: 'Schedule a publish; the five-minute cron performs it' })
  async schedule(@Param('id') id: string, @Body() dto: ScheduleDto): Promise<PersonaAdminDetail> {
    await this.personas.schedule(id, dto.publishAt, new Date());
    return this.personas.findAdminById(id);
  }

  @Post(':id/restore')
  @RequirePermissions('persona:write')
  // 200, not POST's default 201: this returns a persona that already existed
  // rather than creating one, and a 201 would imply a new resource at a new
  // location.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from the trash' })
  async restore(@Param('id') id: string): Promise<PersonaAdminDetail> {
    await this.personas.restore(id);
    return this.personas.findAdminById(id);
  }

  @Delete(':id')
  @RequirePermissions('persona:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete. Recoverable from the trash for 30 days.' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.personas.remove(id);
  }
}
