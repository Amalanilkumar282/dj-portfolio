import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  BrandAdminDetail,
  BrandCreateInput,
  BrandSummary,
  BrandUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { toBrandAdminDetail, toBrandSummary } from './brands.mapper';
import { BrandsRepository } from './brands.repository';

interface BrandScalarWrite {
  slug?: string;
  name?: string;
  websiteUrl?: string | null;
  logoId?: string | null;
  logoMonoId?: string | null;
  category?: string | null;
  isFeatured?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface BrandRowBase extends PublishableRow {
  slug: string;
}

@Injectable()
export class BrandsService extends BaseContentService<BrandRowBase> {
  protected readonly entityName = 'brand' as const;
  protected readonly auditEntityType = 'Brand';

  constructor(
    protected readonly repository: BrandsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  async listPublic(query: {
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: BrandSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      featured: query.featured,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return { data: page.data.map(toBrandSummary), nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: BrandAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toBrandAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<BrandAdminDetail> {
    return toBrandAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: BrandCreateInput, now: Date): Promise<BrandAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.name, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      name: input.name,
    });

    if (input.personaKeys) await this.repository.setPersonas(created.id, input.personaKeys);

    await this.afterMutation(await this.loadForAdmin(created.id), AuditAction.CREATE, 'create');

    return toBrandAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: BrandUpdateInput, now: Date): Promise<BrandAdminDetail> {
    const current = await this.loadForAdmin(id);

    const slug =
      input.slug === undefined
        ? undefined
        : await this.slugs.resolve(
            input.slug,
            input.name ?? current.name,
            (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
            id,
          );

    await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.name === undefined ? {} : { name: input.name }),
    });

    if (input.personaKeys) await this.repository.setPersonas(id, input.personaKeys);

    await this.afterMutation(await this.loadForAdmin(id), AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toBrandAdminDetail(await this.loadForAdmin(id));
  }

  private toWriteData(input: BrandCreateInput | BrandUpdateInput, now: Date): BrandScalarWrite {
    const data: BrandScalarWrite = {};

    if (input.websiteUrl !== undefined) data.websiteUrl = input.websiteUrl;
    if (input.logoId !== undefined) data.logoId = input.logoId;
    if (input.logoMonoId !== undefined) data.logoMonoId = input.logoMonoId;
    if (input.category !== undefined) data.category = input.category;
    if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;
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
        message: `No brand exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
