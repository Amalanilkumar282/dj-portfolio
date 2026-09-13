import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ContentChangedEvent,
  RedirectAdminDetail,
  RedirectCreateInput,
  RedirectDetail,
  RedirectUpdateInput,
} from '@dj/contracts';
import { AuditAction } from '@dj/db';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CONTENT_CHANGED } from '../../infra/revalidation/revalidation.service';
import { AuditService } from '../audit/audit.service';

import { toRedirectAdminDetail, toRedirectDetail } from './redirects.mapper';
import { RedirectsRepository } from './redirects.repository';

interface RedirectScalarWrite {
  fromPath?: string;
  toPath?: string;
  kind?: 'PERMANENT' | 'TEMPORARY';
  isActive?: boolean;
  note?: string | null;
}

/**
 * Redirect business rules.
 *
 * Deliberately does not extend `BaseContentService`: not publishable content
 * — no `status`, no `deletedAt`. Simpler than `GenresService`, too: nothing
 * else references a `Redirect`, so its delete needs no reference guard.
 */
@Injectable()
export class RedirectsService {
  constructor(
    private readonly repository: RedirectsRepository,
    private readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
  ) {}

  /** All active redirects, unpaginated — the web middleware caches this whole. */
  async listActive(): Promise<RedirectDetail[]> {
    const rows = await this.repository.listActive();
    return rows.map(toRedirectDetail);
  }

  async listAdmin(query: {
    q?: string | undefined;
    activeOnly?: boolean | undefined;
    perPage: number;
    page: number;
  }): Promise<{ data: RedirectAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      activeOnly: query.activeOnly,
      orderBy: [{ createdAt: 'desc' }],
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toRedirectAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<RedirectAdminDetail> {
    return toRedirectAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: RedirectCreateInput): Promise<RedirectAdminDetail> {
    await this.assertFromPathFree(input.fromPath);

    const created = await this.repository.create({
      fromPath: input.fromPath,
      toPath: input.toPath,
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.note === undefined ? {} : { note: input.note }),
    });

    await this.afterMutation(created.id, AuditAction.CREATE, 'create');

    return toRedirectAdminDetail(created);
  }

  async update(id: string, input: RedirectUpdateInput): Promise<RedirectAdminDetail> {
    await this.loadForAdmin(id);

    if (input.fromPath !== undefined) await this.assertFromPathFree(input.fromPath, id);

    const updated = await this.repository.update(id, this.toWriteData(input));

    await this.afterMutation(id, AuditAction.UPDATE, 'update', { changed: Object.keys(input) });

    return toRedirectAdminDetail(updated);
  }

  async remove(id: string): Promise<void> {
    await this.loadForAdmin(id);

    await this.repository.hardDelete(id);

    await this.afterMutation(id, AuditAction.DELETE, 'delete', { hardDeleted: true });
  }

  private async assertFromPathFree(fromPath: string, exceptId?: string): Promise<void> {
    if (await this.repository.isFromPathTaken(fromPath, exceptId)) {
      throw new ConflictException({
        message: `A redirect from "${fromPath}" already exists.`,
        code: ERROR_CODES.UNIQUE_CONSTRAINT,
        errors: [{ pointer: '/fromPath', code: 'duplicate', message: 'Already redirected.' }],
      });
    }
  }

  private toWriteData(input: RedirectCreateInput | RedirectUpdateInput): RedirectScalarWrite {
    const data: RedirectScalarWrite = {};

    if (input.fromPath !== undefined) data.fromPath = input.fromPath;
    if (input.toPath !== undefined) data.toPath = input.toPath;
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.note !== undefined) data.note = input.note;

    return data;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);
    if (!row) {
      throw new NotFoundException({
        message: `No redirect exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }

  private async afterMutation(
    id: string,
    action: AuditAction,
    changeAction: ContentChangedEvent['action'],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({ action, entityType: 'Redirect', entityId: id, metadata });

    this.events.emit(CONTENT_CHANGED, {
      entity: 'redirect',
      id,
      action: changeAction,
    } satisfies ContentChangedEvent);
  }
}
