import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

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

  async listPublished(options: {
    when: 'upcoming' | 'past' | 'all';
    personaSlug?: string | undefined;
    venueSlug?: string | undefined;
    programSlug?: string | undefined;
    kind?: string | undefined;
    city?: string | undefined;
    year?: number | undefined;
    featured?: boolean | undefined;
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
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.venueSlug ? { venue: { slug: options.venueSlug } } : {}),
        ...(options.programSlug ? { program: { slug: options.programSlug } } : {}),
        ...(options.kind ? { kind: options.kind as Prisma.EnumEventKindFilter } : {}),
        ...(options.city
          ? {
              OR: [
                { venue: { city: { equals: options.city, mode: 'insensitive' } } },
                { cityOverride: { equals: options.city, mode: 'insensitive' } },
              ],
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
