import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ReleaseAdminDetail,
  ReleaseCreateInput,
  ReleaseDetail,
  ReleaseSummary,
  ReleaseUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus, type ReleaseType } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toReleaseAdminDetail, toReleaseDetail, toReleaseSummary } from './releases.mapper';
import { ReleasesRepository } from './releases.repository';

interface ReleaseScalarWrite {
  slug?: string;
  title?: string;
  artistLabel?: string;
  personaId?: string | null;
  type?: ReleaseType;
  label?: string | null;
  catalogNumber?: string | null;
  upc?: string | null;
  description?: string | null;
  releaseDate?: Date | null;
  isFeatured?: boolean;
  coverId?: string | null;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface ReleaseRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class ReleasesService extends BaseContentService<ReleaseRowBase> {
  protected readonly entityName = 'release' as const;
  protected readonly auditEntityType = 'Release';

  constructor(
    protected readonly repository: ReleasesRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: ReleaseRowBase): string | undefined {
    return row.persona?.slug;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    personaSlug?: string | undefined;
    type?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: ReleaseSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      type: query.type,
      featured: query.featured,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toReleaseSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<ReleaseDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);

    if (!row) {
      throw new NotFoundException({
        message: `No published release exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toReleaseDetail(row);
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
  }): Promise<{ data: ReleaseAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      personaSlug: query.personaSlug,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toReleaseAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<ReleaseAdminDetail> {
    return toReleaseAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: ReleaseCreateInput, now: Date): Promise<ReleaseAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.title, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      title: input.title,
      artistLabel: input.artistLabel,
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.trackIds) {
      await this.repository.setTracks(created.id, input.trackIds);
    }

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    // Re-read so the response includes the tracks just attached.
    return toReleaseAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: ReleaseUpdateInput, now: Date): Promise<ReleaseAdminDetail> {
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

    const personaId = await this.resolvePersonaId(input.personaKey);

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.artistLabel === undefined ? {} : { artistLabel: input.artistLabel }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.trackIds) {
      await this.repository.setTracks(id, input.trackIds);
    }

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toReleaseAdminDetail(input.trackIds ? await this.loadForAdmin(id) : updated);
  }

  private async resolvePersonaId(
    personaKey: ReleaseCreateInput['personaKey'],
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
    input: ReleaseCreateInput | ReleaseUpdateInput,
    now: Date,
  ): ReleaseScalarWrite {
    const data: ReleaseScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[target] = value;
      }
    };

    assign('type');
    assign('label');
    assign('catalogNumber');
    assign('upc');
    assign('description');
    assign('releaseDate');
    assign('isFeatured');
    assign('coverId');
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
        message: `No release exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
