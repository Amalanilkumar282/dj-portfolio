import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  GearItemAdminDetail,
  GearItemCreateInput,
  GearItemDetail,
  GearItemUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus, type GearCategory, type ProficiencyLevel } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { toGearAdminDetail, toGearDetail } from './gear.mapper';
import { GearRepository } from './gear.repository';

interface GearScalarWrite {
  slug?: string;
  category?: GearCategory;
  brand?: string;
  model?: string;
  proficiency?: ProficiencyLevel;
  yearsUsed?: number | null;
  notes?: string | null;
  isRiderItem?: boolean;
  isPreferred?: boolean;
  imageId?: string | null;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface GearRowBase extends PublishableRow {
  slug: string;
}

@Injectable()
export class GearService extends BaseContentService<GearRowBase> {
  protected readonly entityName = 'gear' as const;
  protected readonly auditEntityType = 'GearItem';

  constructor(
    protected readonly repository: GearRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  async listPublic(query: {
    category?: string | undefined;
    riderOnly?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: GearItemDetail[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      category: query.category,
      riderOnly: query.riderOnly,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return { data: page.data.map(toGearDetail), nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: GearItemAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toGearAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<GearItemAdminDetail> {
    return toGearAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: GearItemCreateInput, now: Date): Promise<GearItemAdminDetail> {
    const slug = await this.slugs.resolve(
      input.slug,
      `${input.brand} ${input.model}`,
      (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
    );

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      category: input.category,
      brand: input.brand,
      model: input.model,
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toGearAdminDetail(created);
  }

  async update(id: string, input: GearItemUpdateInput, now: Date): Promise<GearItemAdminDetail> {
    const current = await this.loadForAdmin(id);

    const slug =
      input.slug === undefined
        ? undefined
        : await this.slugs.resolve(
            input.slug,
            `${input.brand ?? current.brand} ${input.model ?? current.model}`,
            (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
            id,
          );

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.brand === undefined ? {} : { brand: input.brand }),
      ...(input.model === undefined ? {} : { model: input.model }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toGearAdminDetail(updated);
  }

  private toWriteData(input: GearItemCreateInput | GearItemUpdateInput, now: Date): GearScalarWrite {
    const data: GearScalarWrite = {};

    if (input.proficiency !== undefined) data.proficiency = input.proficiency;
    if (input.yearsUsed !== undefined) data.yearsUsed = input.yearsUsed;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.isRiderItem !== undefined) data.isRiderItem = input.isRiderItem;
    if (input.isPreferred !== undefined) data.isPreferred = input.isPreferred;
    if (input.imageId !== undefined) data.imageId = input.imageId;
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
        message: `No gear item exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
