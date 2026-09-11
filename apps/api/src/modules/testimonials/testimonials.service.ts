import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  TestimonialAdminDetail,
  TestimonialCreateInput,
  TestimonialDetail,
  TestimonialUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toTestimonialAdminDetail, toTestimonialDetail } from './testimonials.mapper';
import { TestimonialsRepository } from './testimonials.repository';

interface TestimonialScalarWrite {
  authorName?: string;
  authorRole?: string | null;
  venueOrEvent?: string | null;
  company?: string | null;
  quote?: string;
  rating?: number | null;
  eventDate?: Date | null;
  personaId?: string | null;
  avatarId?: string | null;
  sourceUrl?: string | null;
  isFeatured?: boolean;
  isVerified?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface TestimonialRowBase extends PublishableRow {
  persona?: { slug: string } | null;
}

@Injectable()
export class TestimonialsService extends BaseContentService<TestimonialRowBase> {
  protected readonly entityName = 'testimonial' as const;
  protected readonly auditEntityType = 'Testimonial';

  constructor(
    protected readonly repository: TestimonialsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: TestimonialRowBase): string | undefined {
    return row.persona?.slug;
  }

  async listPublic(query: {
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    verifiedOnly?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: TestimonialDetail[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      featured: query.featured,
      verifiedOnly: query.verifiedOnly,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toTestimonialDetail),
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
    data: TestimonialAdminDetail[];
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
      data: rows.map(toTestimonialAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<TestimonialAdminDetail> {
    return toTestimonialAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: TestimonialCreateInput, now: Date): Promise<TestimonialAdminDetail> {
    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      authorName: input.authorName,
      quote: input.quote,
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toTestimonialAdminDetail(created);
  }

  async update(id: string, input: TestimonialUpdateInput, now: Date): Promise<TestimonialAdminDetail> {
    await this.loadForAdmin(id);

    const personaId = await this.resolvePersonaId(input.personaKey);

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(input.authorName === undefined ? {} : { authorName: input.authorName }),
      ...(input.quote === undefined ? {} : { quote: input.quote }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toTestimonialAdminDetail(updated);
  }

  private async resolvePersonaId(
    personaKey: TestimonialCreateInput['personaKey'],
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

  private toWriteData(
    input: TestimonialCreateInput | TestimonialUpdateInput,
    now: Date,
  ): TestimonialScalarWrite {
    const data: TestimonialScalarWrite = {};

    if (input.authorRole !== undefined) data.authorRole = input.authorRole;
    if (input.venueOrEvent !== undefined) data.venueOrEvent = input.venueOrEvent;
    if (input.company !== undefined) data.company = input.company;
    if (input.rating !== undefined) data.rating = input.rating;
    if (input.eventDate !== undefined) data.eventDate = input.eventDate;
    if (input.avatarId !== undefined) data.avatarId = input.avatarId;
    if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
    if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;
    if (input.isVerified !== undefined) data.isVerified = input.isVerified;
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
        message: `No testimonial exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
