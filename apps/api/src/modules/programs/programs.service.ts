import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ProgramAdminDetail,
  ProgramCreateInput,
  ProgramDetail,
  ProgramSummary,
  ProgramUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toProgramAdminDetail, toProgramDetail, toProgramSummary } from './programs.mapper';
import { ProgramsRepository } from './programs.repository';

interface ProgramScalarWrite {
  slug?: string;
  name?: string;
  subtitle?: string | null;
  description?: string | null;
  cadence?: string | null;
  personaId?: string | null;
  venueId?: string | null;
  residencyFrom?: Date | null;
  residencyTo?: Date | null;
  isOngoing?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface ProgramRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class ProgramsService extends BaseContentService<ProgramRowBase> {
  protected readonly entityName = 'program' as const;
  protected readonly auditEntityType = 'Program';

  constructor(
    protected readonly repository: ProgramsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: ProgramRowBase): string | undefined {
    return row.persona?.slug;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    personaSlug?: string | undefined;
    venueSlug?: string | undefined;
    ongoing?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: ProgramSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      venueSlug: query.venueSlug,
      ongoing: query.ongoing,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toProgramSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<ProgramDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);

    if (!row) {
      throw new NotFoundException({
        message: `No published program exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toProgramDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  // ── admin ────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    personaSlug?: string | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: ProgramAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      personaSlug: query.personaSlug,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toProgramAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<ProgramAdminDetail> {
    return toProgramAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: ProgramCreateInput, now: Date): Promise<ProgramAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.name, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      name: input.name,
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toProgramAdminDetail(created);
  }

  async update(id: string, input: ProgramUpdateInput, now: Date): Promise<ProgramAdminDetail> {
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
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toProgramAdminDetail(updated);
  }

  private async resolvePersonaId(
    personaKey: ProgramCreateInput['personaKey'],
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
    input: ProgramCreateInput | ProgramUpdateInput,
    now: Date,
  ): ProgramScalarWrite {
    const data: ProgramScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[target] = value;
      }
    };

    assign('subtitle');
    assign('description');
    assign('cadence');
    assign('venueId');
    assign('residencyFrom');
    assign('residencyTo');
    assign('isOngoing');
    assign('sortIndex');
    assign('scheduledAt');

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === ContentStatus.PUBLISHED) {
        data.publishedAt = now;
      }
    }

    return data;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);

    if (!row) {
      throw new NotFoundException({
        message: `No program exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
