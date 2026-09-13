import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  PostAdminDetail,
  PostCreateInput,
  PostDetail,
  PostSummary,
  PostUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toPostAdminDetail, toPostDetail, toPostSummary } from './posts.mapper';
import { PostsRepository } from './posts.repository';

interface PostScalarWrite {
  slug?: string;
  title?: string;
  excerpt?: string | null;
  content?: object;
  contentText?: string | null;
  readingMinutes?: number | null;
  coverId?: string | null;
  personaId?: string | null;
  authorName?: string | null;
  isFeatured?: boolean;
  sortIndex?: number;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface PostRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class PostsService extends BaseContentService<PostRowBase> {
  protected readonly entityName = 'post' as const;
  protected readonly auditEntityType = 'Post';

  constructor(
    protected readonly repository: PostsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: PostRowBase): string | undefined {
    return row.persona?.slug;
  }

  async listPublic(query: {
    personaSlug?: string | undefined;
    tagSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: PostSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      personaSlug: query.personaSlug,
      tagSlug: query.tagSlug,
      featured: query.featured,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return { data: page.data.map(toPostSummary), nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<PostDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);
    if (!row) {
      throw new NotFoundException({
        message: `No published post exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return toPostDetail(row);
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
  }): Promise<{ data: PostAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toPostAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<PostAdminDetail> {
    return toPostAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: PostCreateInput, now: Date): Promise<PostAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.title, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      title: input.title,
      content: (input.content ?? {}),
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.tagSlugs) await this.repository.setTags(created.id, input.tagSlugs);

    await this.afterMutation(await this.loadForAdmin(created.id), AuditAction.CREATE, 'create');

    return toPostAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: PostUpdateInput, now: Date): Promise<PostAdminDetail> {
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
      ...(input.content === undefined ? {} : { content: input.content as object }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.tagSlugs) await this.repository.setTags(id, input.tagSlugs);

    await this.afterMutation(await this.loadForAdmin(id), AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toPostAdminDetail(await this.loadForAdmin(id));
  }

  private async resolvePersonaId(
    personaKey: PostCreateInput['personaKey'],
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

  private toWriteData(input: PostCreateInput | PostUpdateInput, now: Date): PostScalarWrite {
    const data: PostScalarWrite = {};

    if (input.excerpt !== undefined) data.excerpt = input.excerpt;
    if (input.contentText !== undefined) data.contentText = input.contentText;
    if (input.readingMinutes !== undefined) data.readingMinutes = input.readingMinutes;
    if (input.coverId !== undefined) data.coverId = input.coverId;
    if (input.authorName !== undefined) data.authorName = input.authorName;
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
        message: `No post exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
