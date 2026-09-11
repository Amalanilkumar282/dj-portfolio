import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  ContentChangedEvent,
  StatAdminDetail,
  StatCreateInput,
  StatDetail,
  StatUpdateInput,
} from '@dj/contracts';
import { AuditAction } from '@dj/db';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { CONTENT_CHANGED } from '../../infra/revalidation/revalidation.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toStatAdminDetail, toStatDetail } from './stats.mapper';
import { StatsRepository } from './stats.repository';

interface StatScalarWrite {
  key?: string;
  label?: string;
  value?: string;
  numericValue?: number | null;
  unit?: string | null;
  suffix?: string | null;
  icon?: string | null;
  isVisible?: boolean;
  sortIndex?: number;
}

/**
 * Stat business rules.
 *
 * Deliberately does not extend `BaseContentService`: a stat is a counter, not
 * publishable content — no `status`, no `publishedAt`, no `deletedAt`. See
 * `GenresService` for the same reasoning.
 */
@Injectable()
export class StatsService {
  private readonly entityName = 'stat' as const;
  private readonly auditEntityType = 'Stat';

  constructor(
    private readonly repository: StatsRepository,
    private readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {}

  async listPublic(query: {
    personaSlug?: string | undefined;
    visibleOnly?: boolean | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
  }): Promise<{ data: StatDetail[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.list({
      personaSlug: query.personaSlug,
      visibleOnly: query.visibleOnly,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return { data: page.data.map(toStatDetail), nextCursor: page.nextCursor, hasMore: page.hasMore };
  }

  async listAdmin(query: {
    q?: string | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: StatAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toStatAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<StatAdminDetail> {
    return toStatAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: StatCreateInput): Promise<StatAdminDetail> {
    const personaId = await this.resolvePersonaId(input.personaKey);

    await this.assertKeyFree(input.key, personaId ?? null);

    const created = await this.repository.create({
      ...this.toWriteData(input),
      key: input.key,
      label: input.label,
      value: input.value,
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(created.id, AuditAction.CREATE, 'create', created.persona?.slug);

    return toStatAdminDetail(created);
  }

  async update(id: string, input: StatUpdateInput): Promise<StatAdminDetail> {
    const current = await this.loadForAdmin(id);

    const personaId = await this.resolvePersonaId(input.personaKey);
    const nextPersonaId = personaId === undefined ? (current.persona ? current.personaId : null) : personaId;
    const nextKey = input.key ?? current.key;

    if (input.key !== undefined || personaId !== undefined) {
      await this.assertKeyFree(nextKey, nextPersonaId, id);
    }

    const updated = await this.repository.update(id, {
      ...this.toWriteData(input),
      ...(input.key === undefined ? {} : { key: input.key }),
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.value === undefined ? {} : { value: input.value }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    await this.afterMutation(updated.id, AuditAction.UPDATE, 'update', updated.persona?.slug, {
      changed: Object.keys(input),
    });

    return toStatAdminDetail(updated);
  }

  async remove(id: string): Promise<void> {
    const stat = await this.loadForAdmin(id);

    await this.repository.hardDelete(id);

    await this.afterMutation(id, AuditAction.DELETE, 'delete', stat.persona?.slug, {
      hardDeleted: true,
      key: stat.key,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.repository.reorder(entries);

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: this.auditEntityType,
      metadata: { reordered: entries.length },
    });

    this.events.emit(CONTENT_CHANGED, {
      entity: this.entityName,
      id: 'reorder',
      action: 'update',
    } satisfies ContentChangedEvent);
  }

  private async resolvePersonaId(
    personaKey: StatCreateInput['personaKey'],
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

  private async assertKeyFree(key: string, personaId: string | null, exceptId?: string): Promise<void> {
    if (await this.repository.isKeyTaken(key, personaId, exceptId)) {
      throw new ConflictException({
        message: personaId
          ? `A stat with key "${key}" already exists for this persona.`
          : `A site-wide stat with key "${key}" already exists.`,
        code: ERROR_CODES.UNIQUE_CONSTRAINT,
        errors: [{ pointer: '/key', code: 'duplicate', message: 'This key is already taken.' }],
      });
    }
  }

  private toWriteData(input: StatCreateInput | StatUpdateInput): StatScalarWrite {
    const data: StatScalarWrite = {};

    if (input.numericValue !== undefined) data.numericValue = input.numericValue;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.suffix !== undefined) data.suffix = input.suffix;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.isVisible !== undefined) data.isVisible = input.isVisible;
    if (input.sortIndex !== undefined) data.sortIndex = input.sortIndex;

    return data;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);
    if (!row) {
      throw new NotFoundException({
        message: `No stat exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }

  private async afterMutation(
    id: string,
    action: AuditAction,
    changeAction: ContentChangedEvent['action'],
    personaSlug: string | undefined,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action,
      entityType: this.auditEntityType,
      entityId: id,
      metadata,
    });

    this.events.emit(CONTENT_CHANGED, {
      entity: this.entityName,
      id,
      action: changeAction,
      personaSlug,
    } satisfies ContentChangedEvent);
  }
}
