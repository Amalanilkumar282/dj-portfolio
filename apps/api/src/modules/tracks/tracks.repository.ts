import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Relations a track list or detail may include. */
const INCLUDE_FRAGMENTS = {
  genres: {
    genres: {
      select: { genre: { select: { slug: true, name: true } } },
    },
  },
  streamLinks: {
    streamLinks: {
      orderBy: { sortIndex: 'asc' },
      select: { platform: true, url: true },
    },
  },
  seo: { seoMeta: { select: SEO_SELECT } },
  persona: { persona: { select: { slug: true } } },
} as const;

const AUDIO_SELECT = { secureUrl: true, waveformPeaks: true } as const;

@Injectable()
export class TracksRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = {
      artwork: { select: MEDIA_IMAGE_SELECT },
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
    return {
      ...this.buildInclude(['genres', 'streamLinks', 'seo']),
      audio: { select: AUDIO_SELECT },
    };
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublished(options: {
    personaSlug?: string | undefined;
    type?: string | undefined;
    genreSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.track.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.type ? { type: options.type as Prisma.EnumTrackTypeFilter } : {}),
        ...(options.genreSlug ? { genres: { some: { genre: { slug: options.genreSlug } } } } : {}),
        ...(options.featured === undefined ? {} : { isFeatured: options.featured }),
        ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: {
        artwork: { select: MEDIA_IMAGE_SELECT },
        persona: { select: { slug: true } },
        ...this.buildInclude(options.include),
      },
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.track.findFirst({
      where: { slug, ...publishedWhere() },
      include: {
        artwork: { select: MEDIA_IMAGE_SELECT },
        persona: { select: { slug: true } },
        audio: { select: AUDIO_SELECT },
        ...this.buildInclude(include),
      },
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.track.findMany({
      where: publishedWhere(),
      orderBy: { sortIndex: 'asc' },
      select: { slug: true, updatedAt: true },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  async listForAdmin(options: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    personaSlug?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.track.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: {
          artwork: { select: MEDIA_IMAGE_SELECT },
          ...this.fullInclude(),
        },
      }),
      this.prisma.client.track.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.track.findUnique({
      where: { id },
      include: {
        artwork: { select: MEDIA_IMAGE_SELECT },
        ...this.fullInclude(),
      },
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.track.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.TrackUncheckedCreateInput) {
    return this.prisma.client.track.create({
      data,
      include: { artwork: { select: MEDIA_IMAGE_SELECT }, ...this.fullInclude() },
    });
  }

  async update(id: string, data: Prisma.TrackUncheckedUpdateInput) {
    return this.prisma.client.track.update({
      where: { id },
      data,
      include: { artwork: { select: MEDIA_IMAGE_SELECT }, ...this.fullInclude() },
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.track.update({
      where: { id },
      data,
      include: { artwork: { select: MEDIA_IMAGE_SELECT }, ...this.fullInclude() },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.track.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.track.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: { artwork: { select: MEDIA_IMAGE_SELECT }, ...this.fullInclude() },
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.track.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }

  /**
   * Replaces the genre set wholesale, so removals actually take effect.
   * Mirrors `PersonasRepository.setGenres`, minus `isPrimary`/order — a
   * track's genres have no notion of a primary one.
   */
  async setGenres(trackId: string, genreSlugs: string[]): Promise<void> {
    const genres = await this.prisma.client.genre.findMany({
      where: { slug: { in: genreSlugs } },
      select: { id: true },
    });

    await this.prisma.client.$transaction([
      this.prisma.client.trackGenre.deleteMany({ where: { trackId } }),
      this.prisma.client.trackGenre.createMany({
        data: genres.map((genre) => ({ trackId, genreId: genre.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  /** Replaces the stream-link set wholesale, preserving the caller's order. */
  async setStreamLinks(trackId: string, links: { platform: string; url: string }[]): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.streamLink.deleteMany({ where: { trackId } }),
      this.prisma.client.streamLink.createMany({
        data: links.map((link, index) => ({
          trackId,
          platform: link.platform as Prisma.StreamLinkCreateManyInput['platform'],
          url: link.url,
          sortIndex: index,
        })),
      }),
    ]);
  }
}
