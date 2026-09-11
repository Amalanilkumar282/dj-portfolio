import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  TrackAdminDetail,
  TrackCreateInput,
  TrackDetail,
  TrackSummary,
  TrackUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus, type TrackType } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toTrackAdminDetail, toTrackDetail, toTrackSummary } from './tracks.mapper';
import { TracksRepository } from './tracks.repository';

/** The scalar columns a create or update may set. Relations are handled separately. */
interface TrackScalarWrite {
  slug?: string;
  title?: string;
  artistLabel?: string;
  personaId?: string | null;
  type?: TrackType;
  description?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  durationSec?: number | null;
  releaseDate?: Date | null;
  isFeatured?: boolean;
  soundcloudTrackId?: string | null;
  tags?: string[];
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface TrackRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class TracksService extends BaseContentService<TrackRowBase> {
  protected readonly entityName = 'track' as const;
  protected readonly auditEntityType = 'Track';

  constructor(
    protected readonly repository: TracksRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  /** A track change invalidates its own persona's page, so report its slug. */
  protected override personaSlugOf(row: TrackRowBase): string | undefined {
    return row.persona?.slug;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    personaSlug?: string | undefined;
    type?: string | undefined;
    genreSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: TrackSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      type: query.type,
      genreSlug: query.genreSlug,
      featured: query.featured,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toTrackSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<TrackDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);

    if (!row) {
      throw new NotFoundException({
        message: `No published track exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toTrackDetail(row);
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
  }): Promise<{ data: TrackAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      personaSlug: query.personaSlug,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toTrackAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<TrackAdminDetail> {
    return toTrackAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: TrackCreateInput, now: Date): Promise<TrackAdminDetail> {
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

    if (input.genreSlugs) await this.repository.setGenres(created.id, input.genreSlugs);
    if (input.streamLinks) await this.repository.setStreamLinks(created.id, input.streamLinks);

    await this.afterMutation(await this.loadForAdmin(created.id), AuditAction.CREATE, 'create');

    return toTrackAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: TrackUpdateInput, now: Date): Promise<TrackAdminDetail> {
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

    await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.artistLabel === undefined ? {} : { artistLabel: input.artistLabel }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.genreSlugs) await this.repository.setGenres(id, input.genreSlugs);
    if (input.streamLinks) await this.repository.setStreamLinks(id, input.streamLinks);

    await this.afterMutation(await this.loadForAdmin(id), AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toTrackAdminDetail(await this.loadForAdmin(id));
  }

  /**
   * `personaKey` in the contract, `personaId` in Prisma. `undefined` means
   * "untouched"; `null` means "explicitly clear the relation" — the caller
   * sent `personaKey: null`.
   */
  private async resolvePersonaId(
    personaKey: TrackCreateInput['personaKey'],
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

  private toWriteData(input: TrackCreateInput | TrackUpdateInput, now: Date): TrackScalarWrite {
    const data: TrackScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[target] = value;
      }
    };

    assign('type');
    assign('description');
    assign('bpm');
    assign('musicalKey');
    assign('durationSec');
    assign('releaseDate');
    assign('isFeatured');
    assign('soundcloudTrackId');
    assign('tags');
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
        message: `No track exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
