import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  StaticPageAdminDetail,
  StaticPageCreateInput,
  StaticPageDetail,
  StaticPageUpdateInput,
} from '@dj/contracts';
import { AuditAction, ContentStatus } from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';

import { toStaticPageAdminDetail, toStaticPageDetail } from './static-pages.mapper';
import { StaticPagesRepository } from './static-pages.repository';

interface StaticPageScalarWrite {
  slug?: string;
  title?: string;
  contentText?: string | null;
  lastReviewedAt?: Date | null;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface StaticPageRowBase extends PublishableRow {
  slug: string;
}

/**
 * `StaticPage` has no `sortIndex` column — it is the one publishable model
 * that is never drag-reordered — so `reorder` is inherited from
 * `BaseContentService` but never wired to a route. See
 * `StaticPagesAdminController`, which omits `/reorder`.
 */
@Injectable()
export class StaticPagesService extends BaseContentService<StaticPageRowBase> {
  protected readonly entityName = 'staticPage' as const;
  protected readonly auditEntityType = 'StaticPage';

  constructor(
    protected readonly repository: StaticPagesRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
  ) {
    super();
  }

  async findPublicBySlug(slug: string): Promise<StaticPageDetail> {
    const row = await this.repository.findPublishedBySlug(slug);

    if (!row) {
      throw new NotFoundException({
        message: `No published page exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toStaticPageDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    perPage: number;
    page: number;
  }): Promise<{ data: StaticPageAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      orderBy: [{ title: 'asc' }],
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toStaticPageAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<StaticPageAdminDetail> {
    return toStaticPageAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: StaticPageCreateInput, now: Date): Promise<StaticPageAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.title, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      title: input.title,
      content: (input.content ?? {}),
    });

    await this.afterMutation(created, AuditAction.CREATE, 'create');

    return toStaticPageAdminDetail(created);
  }

  async update(id: string, input: StaticPageUpdateInput, now: Date): Promise<StaticPageAdminDetail> {
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

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.content === undefined ? {} : { content: input.content as object }),
    });

    await this.afterMutation(updated, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toStaticPageAdminDetail(updated);
  }

  private toWriteData(
    input: StaticPageCreateInput | StaticPageUpdateInput,
    now: Date,
  ): StaticPageScalarWrite {
    const data: StaticPageScalarWrite = {};

    if (input.contentText !== undefined) data.contentText = input.contentText;
    if (input.lastReviewedAt !== undefined) data.lastReviewedAt = input.lastReviewedAt;
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
        message: `No static page exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
