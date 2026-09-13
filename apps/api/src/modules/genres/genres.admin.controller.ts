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

import type { GenreAdminDetail } from '@dj/contracts';
import { AuditAction } from '@dj/db';

import {
  Audited,
  CacheControl,
  CACHE_POLICIES,
  Idempotent,
  RequirePermissions,
} from '../../common/decorators';
import { ReorderDto } from '../../common/dto/content.dto';

import { GenreAdminQueryDto, GenreCreateDto, GenreUpdateDto } from './dto/genre.dto';
import { GenresService } from './genres.service';

/**
 * Admin genre writes.
 *
 * The class-level decorators are the security boundary: every route here is
 * authenticated (the global `JwtAccessGuard` denies by default and nothing
 * opts out), permission-checked, and `no-store`.
 *
 * **No publish workflow.** A genre is taxonomy with no `status` column, so
 * there is no `genre:publish` permission and no publish/unpublish/archive/
 * schedule/restore routes — see NON_PUBLISHABLE in the RBAC seed.
 *
 * See docs/02-architecture/backend.md
 */
@ApiTags('admin: genres')
@ApiBearerAuth()
@Controller('admin/genres')
@CacheControl(CACHE_POLICIES.noStore)
export class GenresAdminController {
  constructor(private readonly genres: GenresService) {}

  @Get()
  @RequirePermissions('genre:read')
  @ApiOperation({ summary: 'List genres with usage counts, offset-paginated' })
  async list(@Query() query: GenreAdminQueryDto) {
    const result = await this.genres.listAdmin({
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
  @RequirePermissions('genre:read')
  @ApiOperation({ summary: 'One genre by id, with usage counts' })
  async findOne(@Param('id') id: string): Promise<GenreAdminDetail> {
    return this.genres.findAdminById(id);
  }

  /**
   * Bulk reorder.
   *
   * **Must stay above `@Patch(':id')`.** Routes match in declaration order, so
   * a `:id` route declared first swallows `/reorder` and tries to update a
   * genre whose id is the literal string "reorder" — a 404 that looks like a
   * missing record rather than a routing mistake.
   */
  @Patch('reorder')
  @RequirePermissions('genre:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply a new ordering in one transaction' })
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.genres.reorder(dto.entries);
  }

  @Post()
  @RequirePermissions('genre:write')
  @Idempotent()
  @Audited({ action: AuditAction.CREATE, entityType: 'Genre' })
  @ApiOperation({ summary: 'Create a genre' })
  async create(@Body() dto: GenreCreateDto): Promise<GenreAdminDetail> {
    return this.genres.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('genre:write')
  @ApiOperation({ summary: 'Update a genre. Unmentioned fields are untouched.' })
  async update(@Param('id') id: string, @Body() dto: GenreUpdateDto): Promise<GenreAdminDetail> {
    return this.genres.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('genre:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a genre. 409 with the referencing content if it is still in use.',
    description:
      'This is a real delete — a genre has no deletedAt. Both join tables cascade, so ' +
      'deleting a genre in use would silently strip it from every persona and track. ' +
      'The endpoint refuses instead, listing what is in the way.',
  })
  async remove(@Param('id') id: string): Promise<void> {
    await this.genres.remove(id);
  }
}
