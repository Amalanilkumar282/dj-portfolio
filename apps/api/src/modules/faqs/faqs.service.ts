import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { FaqAdminDetail, FaqCreateInput, FaqDetail, FaqUpdateInput } from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toFaqAdminDetail, toFaqDetail } from './faqs.mapper';
import { FaqsRepository } from './faqs.repository';

interface FaqScalarWrite {
  slug?: string;
  question?: string;
  answer?: string;
  category?: string | null;
  personaId?: string | null;
  serviceId?: string | null;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface FaqRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class FaqsService extends BaseContentService<FaqRowBase> {
  protected readonly entityName = 'faq' as const;
  protected readonly auditEntityType = 'Faq';

  constructor(
    protected readonly repository: FaqsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: FaqRowBase): string | undefined {
    return row.persona?.slug;
  }

  async listPublic(query: {
    category?: string | undefined;
    personaSlug?: string | undefined;
    serviceSlug?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: FaqDetail[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      category: query.category,
      personaSlug: query.personaSlug,
      serviceSlug: query.serviceSlug,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return { data: page.data.map(toFaqDetail), nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: FaqAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toFaqAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<FaqAdminDetail> {
    return toFaqAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: FaqCreateInput, now: Date): Promise<FaqAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.question, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId = await this.resolvePersonaId(input.personaKey);
    await this.assertServiceExists(input.serviceId);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      question: input.question,
      answer: input.answer,
      ...(personaId === undefined ? {} : { personaId }),
      ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toFaqAdminDetail(created);
  }

  async update(id: string, input: FaqUpdateInput, now: Date): Promise<FaqAdminDetail> {
    const current = await this.loadForAdmin(id);

    const slug =
      input.slug === undefined
        ? undefined
        : await this.slugs.resolve(
            input.slug,
            input.question ?? current.question,
            (candidate, exceptId) => this.repository.isSlugTaken(candidate, exceptId),
            id,
          );

    const personaId = await this.resolvePersonaId(input.personaKey);
    await this.assertServiceExists(input.serviceId);

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.question === undefined ? {} : { question: input.question }),
      ...(input.answer === undefined ? {} : { answer: input.answer }),
      ...(personaId === undefined ? {} : { personaId }),
      ...(input.serviceId === undefined ? {} : { serviceId: input.serviceId }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toFaqAdminDetail(updated);
  }

  private async resolvePersonaId(
    personaKey: FaqCreateInput['personaKey'],
  ): Promise<string | null | undefined> {
    if (personaKey === undefined) return undefined;
    if (personaKey === null) return null;

    const persona = await this.personas.findIdByKey(personaKey);
    if (!persona) {
      throw new NotFoundException({
        message: `No persona exists for key "${personaKey}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return persona.id;
  }

  private async assertServiceExists(serviceId: string | null | undefined): Promise<void> {
    if (!serviceId) return;
    if (!(await this.repository.serviceExists(serviceId))) {
      throw new NotFoundException({
        message: `No service exists with id "${serviceId}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
  }

  private toWriteData(input: FaqCreateInput | FaqUpdateInput, now: Date): FaqScalarWrite {
    const data: FaqScalarWrite = {};

    if (input.category !== undefined) data.category = input.category;
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
        message: `No FAQ exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
