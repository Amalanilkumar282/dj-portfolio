import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ExperienceEntryAdminDetail,
  ExperienceEntryCreateInput,
  ExperienceEntryDetail,
  ExperienceEntryUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { AuditService } from '../audit/audit.service';

import { toExperienceAdminDetail, toExperienceDetail } from './experience.mapper';
import { ExperienceRepository } from './experience.repository';

interface ExperienceScalarWrite {
  role?: string;
  organisation?: string;
  location?: string | null;
  startDate?: Date;
  endDate?: Date | null;
  isCurrent?: boolean;
  summary?: string | null;
  highlights?: string[];
  logoId?: string | null;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

type ExperienceRowBase = PublishableRow;

@Injectable()
export class ExperienceService extends BaseContentService<ExperienceRowBase> {
  protected readonly entityName = 'experience' as const;
  protected readonly auditEntityType = 'ExperienceEntry';

  constructor(
    protected readonly repository: ExperienceRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  async listPublic(query: {
    current?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: ExperienceEntryDetail[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      current: query.current,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toExperienceDetail),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{
    data: ExperienceEntryAdminDetail[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toExperienceAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<ExperienceEntryAdminDetail> {
    return toExperienceAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: ExperienceEntryCreateInput, now: Date): Promise<ExperienceEntryAdminDetail> {
    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      role: input.role,
      organisation: input.organisation,
      startDate: input.startDate,
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toExperienceAdminDetail(created);
  }

  async update(
    id: string,
    input: ExperienceEntryUpdateInput,
    now: Date,
  ): Promise<ExperienceEntryAdminDetail> {
    await this.loadForAdmin(id);

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(input.role === undefined ? {} : { role: input.role }),
      ...(input.organisation === undefined ? {} : { organisation: input.organisation }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toExperienceAdminDetail(updated);
  }

  private toWriteData(
    input: ExperienceEntryCreateInput | ExperienceEntryUpdateInput,
    now: Date,
  ): ExperienceScalarWrite {
    const data: ExperienceScalarWrite = {};

    if (input.location !== undefined) data.location = input.location;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.isCurrent !== undefined) data.isCurrent = input.isCurrent;
    if (input.summary !== undefined) data.summary = input.summary;
    if (input.highlights !== undefined) data.highlights = input.highlights;
    if (input.logoId !== undefined) data.logoId = input.logoId;
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
        message: `No experience entry exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
