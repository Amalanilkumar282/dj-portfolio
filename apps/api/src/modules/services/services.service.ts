import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ServiceAdminDetail,
  ServiceCreateInput,
  ServiceDetail,
  ServiceSummary,
  ServiceUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus, type Currency, type ServiceCategory } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toServiceAdminDetail, toServiceDetail, toServiceSummary } from './services.mapper';
import { ServicesRepository } from './services.repository';

interface ServiceScalarWrite {
  slug?: string;
  name?: string;
  category?: ServiceCategory;
  summary?: string | null;
  description?: string | null;
  inclusions?: string[];
  exclusions?: string[];
  addons?: string[];
  durationHours?: number | null;
  priceFrom?: number | null;
  priceTo?: number | null;
  currency?: Currency;
  personaId?: string | null;
  imageId?: string | null;
  isFeatured?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface ServiceRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class ServicesService extends BaseContentService<ServiceRowBase> {
  protected readonly entityName = 'service' as const;
  protected readonly auditEntityType = 'Service';

  constructor(
    protected readonly repository: ServicesRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: ServiceRowBase): string | undefined {
    return row.persona?.slug;
  }

  async listPublic(query: {
    category?: string | undefined;
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: ServiceSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      category: query.category,
      personaSlug: query.personaSlug,
      featured: query.featured,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toServiceSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<ServiceDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);
    if (!row) {
      throw new NotFoundException({
        message: `No published service exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return toServiceDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: ServiceAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toServiceAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<ServiceAdminDetail> {
    return toServiceAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: ServiceCreateInput, now: Date): Promise<ServiceAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.name, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      name: input.name,
      category: input.category,
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toServiceAdminDetail(created);
  }

  async update(id: string, input: ServiceUpdateInput, now: Date): Promise<ServiceAdminDetail> {
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

    const personaId = await this.resolvePersonaId(input.personaKey);

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toServiceAdminDetail(updated);
  }

  private async resolvePersonaId(
    personaKey: ServiceCreateInput['personaKey'],
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

  private toWriteData(input: ServiceCreateInput | ServiceUpdateInput, now: Date): ServiceScalarWrite {
    const data: ServiceScalarWrite = {};

    if (input.summary !== undefined) data.summary = input.summary;
    if (input.description !== undefined) data.description = input.description;
    if (input.inclusions !== undefined) data.inclusions = input.inclusions;
    if (input.exclusions !== undefined) data.exclusions = input.exclusions;
    if (input.addons !== undefined) data.addons = input.addons;
    if (input.durationHours !== undefined) data.durationHours = input.durationHours;
    if (input.priceFrom !== undefined) data.priceFrom = input.priceFrom;
    if (input.priceTo !== undefined) data.priceTo = input.priceTo;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.imageId !== undefined) data.imageId = input.imageId;
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
        message: `No service exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
