import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * How long a show is assumed to run when it has no stated `endsAt`.
 * Kept in step with ASSUMED_RUN_MS in @dj/utils' show-phase helper — the
 * repository's `live` window, the cron's reconciliation and the public
 * badge must all agree on when a show is over.
 */
export const ASSUMED_RUN_HOURS = 6;

const VENUE_SELECT = {
  id: true,
  slug: true,
  name: true,
  city: true,
  state: true,
  country: true,
  latitude: true,
  longitude: true,
  capacity: true,
  _count: { select: { events: true } },
} as const;

const INCLUDE_FRAGMENTS = {
  persona: { persona: { select: { slug: true } } },
  venue: { venue: { select: VENUE_SELECT } },
  lineup: {
    lineup: {
      orderBy: { sortIndex: 'asc' },
      select: {
        artistName: true,
        role: true,
        isHeadliner: true,
        persona: { select: { slug: true } },
      },
    },
  },
  program: { program: { select: { slug: true } } },
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = {
      flyer: { select: MEDIA_IMAGE_SELECT },
      venue: { select: VENUE_SELECT },
      persona: { select: { slug: true } },
    };

    for (const key of include) {
      const fragment = (INCLUDE_FRAGMENTS as Record<string, object | undefined>)[key];
      if (fragment) Object.assign(base, fragment);
    }

    return base;
  }

  /** Always merged in for the admin/detail shapes, which need every relation. */
  private fullInclude(): Record<string, unknown> {
    return this.buildInclude(['lineup', 'program', 'seo']);
  }

  // ── public reads ─────────────────────────────────────────────────────────

  /**
   * "On right now" — started, and not yet finished.
   *
   * `isPast` cannot answer this: the cron only flips it hourly, so for up to
   * an hour after doors an event is neither upcoming nor past by that flag.
   * A show with no stated `endsAt` is treated as running for
   * `ASSUMED_RUN_HOURS`, matching `resolveShowPhase()` in @dj/utils — the two
   * must agree, or a card badged "Happening now" would be missing from the
   * row that is supposed to hold exactly those.
   */
  private liveWhere(now: Date): Record<string, unknown> {
    const assumedEarliestStart = new Date(now.getTime() - ASSUMED_RUN_HOURS * 60 * 60 * 1000);

    return {
      startsAt: { lte: now },
      OR: [
        { endsAt: { gt: now } },
        { endsAt: null, startsAt: { gt: assumedEarliestStart, lte: now } },
      ],
    };
  }

  async listPublished(options: {
    when: 'upcoming' | 'past' | 'live' | 'all';
    personaSlug?: string | undefined;
    venueSlug?: string | undefined;
    programSlug?: string | undefined;
    kind?: string | undefined;
    city?: string | undefined;
    year?: number | undefined;
    featured?: boolean | undefined;
    hasFlyer?: boolean | undefined;
    now: Date;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.event.findMany({
      where: {
        ...publishedWhere(),
        ...(options.when === 'upcoming' ? { isPast: false } : {}),
        ...(options.when === 'past' ? { isPast: true } : {}),
        ...(options.when === 'live' ? this.liveWhere(options.now) : {}),
        ...(options.hasFlyer === undefined
          ? {}
          : options.hasFlyer
            ? { flyerId: { not: null } }
            : { flyerId: null }),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.venueSlug ? { venue: { slug: options.venueSlug } } : {}),
        ...(options.programSlug ? { program: { slug: options.programSlug } } : {}),
        ...(options.kind ? { kind: options.kind as Prisma.EnumEventKindFilter } : {}),
        // `AND`-wrapped rather than a bare `OR`, because `liveWhere()` also
        // uses `OR` at this level and one would silently overwrite the other.
        ...(options.city
          ? {
              AND: [{ OR: [
                { venue: { city: { equals: options.city, mode: 'insensitive' } } },
                { cityOverride: { equals: options.city, mode: 'insensitive' } },
              ] }],
            }
          : {}),
        ...(options.year
          ? {
              startsAt: {
                gte: new Date(Date.UTC(options.year, 0, 1)),
                lt: new Date(Date.UTC(options.year + 1, 0, 1)),
              },
            }
          : {}),
        ...(options.featured === undefined ? {} : { isFeatured: options.featured }),
        ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: this.buildInclude(options.include),
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.event.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(['lineup', 'program', ...include]),
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.event.findMany({
      where: publishedWhere(),
      orderBy: { startsAt: 'desc' },
      select: { slug: true, updatedAt: true },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  async listForAdmin(options: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    personaSlug?: string | undefined;
    when?: 'upcoming' | 'past' | 'all' | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
      ...(options.when === 'upcoming' ? { isPast: false } : {}),
      ...(options.when === 'past' ? { isPast: true } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.event.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.fullInclude(),
      }),
      this.prisma.client.event.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.event.findUnique({
      where: { id },
      include: this.fullInclude(),
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.event.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.EventUncheckedCreateInput) {
    return this.prisma.client.event.create({ data, include: this.fullInclude() });
  }

  async update(id: string, data: Prisma.EventUncheckedUpdateInput) {
    return this.prisma.client.event.update({ where: { id }, data, include: this.fullInclude() });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.event.update({ where: { id }, data, include: this.fullInclude() });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.event.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.event.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.fullInclude(),
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.event.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }

  /**
   * Brings `isPast` back in line with the clock, in both directions.
   *
   * The schema has always documented this column as "maintained by the hourly
   * cron" and nothing ever maintained it, so every upcoming/past split in the
   * app was reading a flag frozen at whatever the row was created with.
   *
   * Both directions matter: a show whose date is corrected *forward* (a
   * postponement re-dated by hand) has to come back out of the archive, or it
   * silently never appears in "Upcoming" again.
   *
   * `pg_try_advisory_xact_lock` is transaction-scoped, so it is released on
   * commit and is safe under pgbouncer transaction pooling — the same reason
   * `MediaRepository.sweepOrphans` uses that form rather than the session one.
   */
  async syncPastFlags(now: Date): Promise<{ ran: boolean; markedPast: number; markedUpcoming: number }> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const [lockRow] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('events-past-flag')) AS locked`;

        if (!lockRow?.locked) return { ran: false, markedPast: 0, markedUpcoming: 0 };

        // "Over" means past its stated end, or past the assumed run length
        // when it has no stated end - the same rule liveWhere() and
        // resolveShowPhase() apply, so the three cannot disagree.
        const assumedEarliestStart = new Date(
          now.getTime() - ASSUMED_RUN_HOURS * 60 * 60 * 1000,
        );

        const isOver = {
          OR: [
            { endsAt: { lte: now } },
            { endsAt: null, startsAt: { lte: assumedEarliestStart } },
          ],
        };

        const markedPast = await tx.event.updateMany({
          where: { isPast: false, ...isOver },
          data: { isPast: true },
        });

        const markedUpcoming = await tx.event.updateMany({
          where: {
            isPast: true,
            NOT: isOver,
          },
          data: { isPast: false },
        });

        return { ran: true, markedPast: markedPast.count, markedUpcoming: markedUpcoming.count };
      },
      { timeout: 60_000, maxWait: 5_000 },
    );
  }

  /**
   * Replaces the lineup wholesale, so removals actually take effect. Each
   * slot's `personaKey` has already been resolved to a `personaId` by the
   * service — the repository stays Prisma-only.
   */
  async setLineup(
    eventId: string,
    slots: {
      artistName: string;
      personaId: string | null;
      role: string | null;
      isHeadliner: boolean;
    }[],
  ): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.eventLineupSlot.deleteMany({ where: { eventId } }),
      this.prisma.client.eventLineupSlot.createMany({
        data: slots.map((slot, index) => ({
          eventId,
          artistName: slot.artistName,
          personaId: slot.personaId,
          role: slot.role,
          isHeadliner: slot.isHeadliner,
          sortIndex: index,
        })),
      }),
    ]);
  }
}
