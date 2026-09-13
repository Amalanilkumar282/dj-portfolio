import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  GalleryAdminDetail,
  GalleryCreateInput,
  GalleryDetail,
  GallerySummary,
  GalleryUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { toGalleryAdminDetail, toGallerySummary, toGalleryDetail } from './galleries.mapper';
import { GalleriesRepository } from './galleries.repository';

interface GalleryScalarWrite {
  slug?: string;
  title?: string;
  description?: string | null;
  personaId?: string | null;
  layout?: 'MASONRY' | 'GRID' | 'CAROUSEL';
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface GalleryRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class GalleriesService extends BaseContentService<GalleryRowBase> {
  protected readonly entityName = 'gallery' as const;
  protected readonly auditEntityType = 'Gallery';

  constructor(
    protected readonly repository: GalleriesRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  protected override personaSlugOf(row: GalleryRowBase): string | undefined {
    return row.persona?.slug;
  }

  async listPublic(query: {
    personaSlug?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: GallerySummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return { data: page.data.map(toGallerySummary), nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async findPublicBySlug(slug: string): Promise<GalleryDetail | null> {
    const row = await this.repository.findPublishedBySlug(slug);
    return row ? toGalleryDetail(row) : null;
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: GalleryAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toGalleryAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<GalleryAdminDetail> {
    return toGalleryAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: GalleryCreateInput, now: Date): Promise<GalleryAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.title, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId =
      input.personaKey === undefined ? undefined : await this.repository.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      title: input.title,
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.items) await this.repository.replaceItems(created.id, input.items);

    await this.afterMutation(await this.loadForAdmin(created.id), AuditAction.CREATE, 'create');

    return toGalleryAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: GalleryUpdateInput, now: Date): Promise<GalleryAdminDetail> {
    const current = await this.loadForAdmin(id);

    const slug =
      input.slug === undefined
        ? undefined
        : await this.slugs.resolve(
            input.slug,
            input.title ?? current.title,
            (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
            id,
          );

    const personaId =
      input.personaKey === undefined ? undefined : await this.repository.resolvePersonaId(input.personaKey);

    await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.items) await this.repository.replaceItems(id, input.items);

    await this.afterMutation(await this.loadForAdmin(id), AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toGalleryAdminDetail(await this.loadForAdmin(id));
  }

  private toWriteData(input: GalleryCreateInput | GalleryUpdateInput, now: Date): GalleryScalarWrite {
    const data: GalleryScalarWrite = {};

    if (input.description !== undefined) data.description = input.description;
    if (input.layout !== undefined) data.layout = input.layout;
    if (input.sortIndex !== undefined) data.sortIndex = input.sortIndex;
    if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === ContentStatus.PUBLISHED) data.publishedAt = now;
    }

    return data;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);
    if (!row) {
      throw new NotFoundException({
        message: `No gallery exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
