import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  VideoAdminDetail,
  VideoCreateInput,
  VideoDetail,
  VideoSummary,
  VideoUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { composeEmbedUrl } from './videos.embed';
import { toVideoAdminDetail, toVideoDetail, toVideoSummary } from './videos.mapper';
import { VideosRepository } from './videos.repository';

type Provider = 'YOUTUBE' | 'VIMEO' | 'CLOUDINARY';

interface VideoScalarWrite {
  slug?: string;
  title?: string;
  description?: string | null;
  provider?: Provider;
  providerVideoId?: string | null;
  embedUrl?: string | null;
  hostedMediaId?: string | null;
  thumbnailId?: string | null;
  durationSec?: number | null;
  personaId?: string | null;
  eventId?: string | null;
  transcript?: string | null;
  isFeatured?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface VideoRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class VideosService extends BaseContentService<VideoRowBase> {
  protected readonly entityName = 'video' as const;
  protected readonly auditEntityType = 'Video';

  constructor(
    protected readonly repository: VideosRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
  ) {
    super();
  }

  protected override personaSlugOf(row: VideoRowBase): string | undefined {
    return row.persona?.slug;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    personaSlug?: string | undefined;
    eventSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: VideoSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      eventSlug: query.eventSlug,
      featured: query.featured,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toVideoSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string): Promise<VideoDetail | null> {
    const row = await this.repository.findPublishedBySlug(slug);
    return row ? toVideoDetail(row) : null;
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  // ── admin ────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: VideoAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toVideoAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<VideoAdminDetail> {
    return toVideoAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: VideoCreateInput, now: Date): Promise<VideoAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.title, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId =
      input.personaKey === undefined
        ? undefined
        : await this.repository.resolvePersonaId(input.personaKey);

    const provider = input.provider ?? 'YOUTUBE';

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      title: input.title,
      provider,
      embedUrl: composeEmbedUrl(provider, input.providerVideoId ?? null),
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(await this.loadForAdmin(created.id), AuditAction.CREATE, 'create');

    return toVideoAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: VideoUpdateInput, now: Date): Promise<VideoAdminDetail> {
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
      input.personaKey === undefined
        ? undefined
        : await this.repository.resolvePersonaId(input.personaKey);

    // `VideoUpdateInput` is a partial, so its create-time refinement was
    // dropped — a partial cannot see the fields it would need to compare.
    // The merge of "what is stored" with "what this PATCH changes" is the
    // only place that can, so the playability check is re-run here rather
    // than trusted to the contract. Without it, switching provider to
    // CLOUDINARY without supplying a hosted asset would store a video that
    // nothing on the site can play.
    const provider = input.provider ?? current.provider;
    const providerVideoId =
      input.providerVideoId === undefined ? current.providerVideoId : input.providerVideoId;
    const hostedMediaId =
      input.hostedMediaId === undefined ? current.hostedMediaId : input.hostedMediaId;

    if (provider === 'CLOUDINARY' ? !hostedMediaId : !providerVideoId) {
      throw new BadRequestException({
        message:
          'A YouTube or Vimeo video needs its provider video id; a Cloudinary video needs a hosted media asset.',
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    }

    await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      provider,
      // Always recomposed, never patched: both the provider and the id feed
      // it, so changing either one alone would otherwise leave a stale embed
      // pointing at the previous video.
      embedUrl: composeEmbedUrl(provider, providerVideoId),
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(await this.loadForAdmin(id), AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toVideoAdminDetail(await this.loadForAdmin(id));
  }

  private toWriteData(input: VideoCreateInput | VideoUpdateInput, now: Date): VideoScalarWrite {
    const data: VideoScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) (data as Record<string, unknown>)[target] = value;
    };

    assign('description');
    assign('providerVideoId');
    assign('hostedMediaId');
    assign('thumbnailId');
    assign('durationSec');
    assign('eventId');
    assign('transcript');
    assign('isFeatured');
    assign('sortIndex');
    assign('scheduledAt');

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
        message: `No video exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
