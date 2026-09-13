import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  EventAdminDetail,
  EventCreateInput,
  EventDetail,
  EventSummary,
  EventUpdateInput,
} from '@dj/contracts';
import {
  AuditAction,
  ContentStatus,
  type Currency,
  type EventKind,
  type EventStatus,
} from '@dj/db';

import { BaseContentService, type DomainEventBus, type PublishableRow } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { CursorService, type SortField } from '../../common/services/cursor.service';
import { SlugService } from '../../common/services/slug.service';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toEventAdminDetail, toEventDetail, toEventSummary } from './events.mapper';
import { EventsRepository } from './events.repository';

/**
 * The scalar columns a create or update may set.
 *
 * `isPast` is deliberately absent: the schema documents it as "maintained by
 * the hourly cron", so writing to it here would fight that single writer and
 * risk a page showing in the wrong list between cron runs.
 */
interface EventScalarWrite {
  slug?: string;
  title?: string;
  subtitle?: string | null;
  kind?: EventKind;
  eventStatus?: EventStatus;
  description?: string | null;
  personaId?: string | null;
  venueId?: string | null;
  venueNameOverride?: string | null;
  cityOverride?: string | null;
  countryOverride?: string | null;
  programId?: string | null;
  startsAt?: Date;
  endsAt?: Date | null;
  timezone?: string;
  isAllDay?: boolean;
  doorsOpenAt?: Date | null;
  ticketUrl?: string | null;
  ticketPriceMin?: number | null;
  ticketPriceMax?: number | null;
  isFree?: boolean;
  ageRestriction?: string | null;
  isFeatured?: boolean;
  attendanceEstimate?: number | null;
  flyerId?: string | null;
  sortIndex?: number;
  currency?: Currency;
  status?: ContentStatus;
  publishedAt?: Date;
  scheduledAt?: Date | null;
}

interface EventRowBase extends PublishableRow {
  slug: string;
  persona?: { slug: string } | null;
}

@Injectable()
export class EventsService extends BaseContentService<EventRowBase> {
  protected readonly entityName = 'event' as const;
  protected readonly auditEntityType = 'Event';

  constructor(
    protected readonly repository: EventsRepository,
    protected readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) protected readonly events: DomainEventBus,
    private readonly slugs: SlugService,
    private readonly cursors: CursorService,
    private readonly personas: PersonasService,
  ) {
    super();
  }

  protected override personaSlugOf(row: EventRowBase): string | undefined {
    return row.persona?.slug;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublic(query: {
    when: 'upcoming' | 'past' | 'all';
    personaSlug?: string | undefined;
    venueSlug?: string | undefined;
    programSlug?: string | undefined;
    kind?: string | undefined;
    city?: string | undefined;
    year?: number | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    sort: SortField[];
    limit: number;
    cursor?: string | undefined;
    include: string[];
  }): Promise<{ data: EventSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const keyset =
      query.cursor === undefined
        ? undefined
        : this.cursors.toWhere(this.cursors.decode(query.cursor), query.sort);

    const rows = await this.repository.listPublished({
      when: query.when,
      personaSlug: query.personaSlug,
      venueSlug: query.venueSlug,
      programSlug: query.programSlug,
      kind: query.kind,
      city: query.city,
      year: query.year,
      featured: query.featured,
      q: query.q,
      keyset,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.limit + 1,
      include: query.include,
    });

    const page = this.cursors.paginate(rows, query.limit, query.sort);

    return {
      data: page.data.map(toEventSummary),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  async findPublicBySlug(slug: string, include: string[]): Promise<EventDetail> {
    const row = await this.repository.findPublishedBySlug(slug, include);

    if (!row) {
      throw new NotFoundException({
        message: `No published event exists at "${slug}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toEventDetail(row);
  }

  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedSlugs();
  }

  // ── admin ────────────────────────────────────────────────────────────────

  async listAdmin(query: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    personaSlug?: string | undefined;
    when?: 'upcoming' | 'past' | 'all' | undefined;
    sort: SortField[];
    perPage: number;
    page: number;
  }): Promise<{ data: EventAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      q: query.q,
      status: query.status,
      personaSlug: query.personaSlug,
      when: query.when,
      orderBy: this.cursors.toOrderBy(query.sort),
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toEventAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<EventAdminDetail> {
    return toEventAdminDetail(await this.loadForAdmin(id));
  }

  async create(input: EventCreateInput, now: Date): Promise<EventAdminDetail> {
    const slug = await this.slugs.resolve(input.slug, input.title, (candidate, exceptId) =>
      this.repository.isSlugTaken(candidate, exceptId),
    );

    const personaId = await this.resolvePersonaId(input.personaKey);

    const created = await this.repository.create({
      ...this.toWriteData(input, now),
      slug,
      title: input.title,
      startsAt: input.startsAt,
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.lineup) await this.setLineup(created.id, input.lineup);

    await this.afterMutation(await this.loadForAdmin(created.id), AuditAction.CREATE, 'create');

    return toEventAdminDetail(await this.loadForAdmin(created.id));
  }

  async update(id: string, input: EventUpdateInput, now: Date): Promise<EventAdminDetail> {
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
      ...(input.startsAt === undefined ? {} : { startsAt: input.startsAt }),
      ...(personaId === undefined ? {} : { personaId }),
    });

    if (input.lineup) await this.setLineup(id, input.lineup);

    await this.afterMutation(await this.loadForAdmin(id), AuditAction.UPDATE, 'update', {
      changed: Object.keys(input),
    });

    return toEventAdminDetail(await this.loadForAdmin(id));
  }

  /** Resolves each slot's `personaKey` (a guest artist may have none). */
  private async setLineup(
    eventId: string,
    lineup: NonNullable<EventCreateInput['lineup']>,
  ): Promise<void> {
    const slots = await Promise.all(
      lineup.map(async (slot) => ({
        artistName: slot.artistName,
        personaId: slot.personaKey
          ? ((await this.resolvePersonaId(slot.personaKey)) ?? null)
          : null,
        role: slot.role ?? null,
        isHeadliner: slot.isHeadliner ?? false,
      })),
    );

    await this.repository.setLineup(eventId, slots);
  }

  private async resolvePersonaId(
    personaKey: EventCreateInput['personaKey'],
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

  private toWriteData(input: EventCreateInput | EventUpdateInput, now: Date): EventScalarWrite {
    const data: EventScalarWrite = {};

    const assign = (key: keyof typeof input, target: string = key): void => {
      const value = input[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[target] = value;
      }
    };

    assign('subtitle');
    assign('kind');
    assign('eventStatus');
    assign('description');
    assign('venueId');
    assign('venueNameOverride');
    assign('cityOverride');
    assign('countryOverride');
    assign('programId');
    assign('endsAt');
    assign('timezone');
    assign('isAllDay');
    assign('doorsOpenAt');
    assign('ticketUrl');
    assign('ticketPriceMin');
    assign('ticketPriceMax');
    assign('currency');
    assign('isFree');
    assign('ageRestriction');
    assign('isFeatured');
    assign('attendanceEstimate');
    assign('flyerId');
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
        message: `No event exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return row;
  }
}
