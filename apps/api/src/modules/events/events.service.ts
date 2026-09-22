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
import { ASSUMED_RUN_HOURS, EventsRepository } from './events.repository';

/**
 * The scalar columns a create or update may set.
 *
 * `isPast` is **derived** here, never accepted from the client — see
 * `derivePastFlag`. It is not a field the caller may set directly, which is
 * why it is absent from the write contracts.
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
  onSaleFrom?: Date | null;
  earlyBirdUntil?: Date | null;
  earlyBirdPriceMax?: number | null;
  isFree?: boolean;
  ageRestriction?: string | null;
  isFeatured?: boolean;
  attendanceEstimate?: number | null;
  isPast?: boolean;
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
    when: 'upcoming' | 'past' | 'live' | 'all';
    personaSlug?: string | undefined;
    venueSlug?: string | undefined;
    programSlug?: string | undefined;
    kind?: string | undefined;
    city?: string | undefined;
    year?: number | undefined;
    featured?: boolean | undefined;
    hasFlyer?: boolean | undefined;
    /**
     * Supplied by the controller, like every other clock read in this app.
     * `when: 'live'` has to compare against a real instant, and `isPast` is
     * only accurate to the hour the cron last ran - too coarse to answer
     * "is he on stage right now".
     */
    now: Date;
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
      hasFlyer: query.hasFlyer,
      now: query.now,
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
      isPast: this.derivePastFlag(input.startsAt, input.endsAt ?? null, now),
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

    // Recomputed only when a date actually moved. Recomputing on every PATCH
    // would let an unrelated edit (a typo in the title) silently undo the
    // cron's own reconciliation in the other direction.
    const datesChanged = input.startsAt !== undefined || input.endsAt !== undefined;

    await this.repository.update(id, {
      ...this.toWriteData(input, now),
      ...(slug === undefined ? {} : { slug }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.startsAt === undefined ? {} : { startsAt: input.startsAt }),
      ...(datesChanged
        ? {
            isPast: this.derivePastFlag(
              input.startsAt ?? current.startsAt,
              input.endsAt === undefined ? current.endsAt : input.endsAt,
              now,
            ),
          }
        : {}),
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

  /**
   * Whether this event is already over, from its own dates.
   *
   * The hourly cron reconciles this column as time passes, but it cannot be
   * the *only* writer: an event entered with a date in the past — the artist
   * backfilling shows he has already played, which is exactly what fills the
   * "Recently played" row — would be created with `isPast: false` and sit
   * under "Upcoming" until the next cron tick. Advertising a March gig as
   * upcoming in September is worse than a stale flag.
   *
   * Deliberately the same rule as `liveWhere()` and `resolveShowPhase()`:
   * over means past its stated end, or past the assumed run length when it
   * has no stated end.
   */
  private derivePastFlag(startsAt: Date, endsAt: Date | null, now: Date): boolean {
    const end = endsAt ?? new Date(startsAt.getTime() + ASSUMED_RUN_HOURS * 60 * 60 * 1000);
    return end.getTime() <= now.getTime();
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
    assign('onSaleFrom');
    assign('earlyBirdUntil');
    assign('earlyBirdPriceMax');
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
