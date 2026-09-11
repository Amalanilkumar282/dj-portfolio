import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const TRACK_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  artistLabel: true,
  type: true,
  bpm: true,
  musicalKey: true,
  durationSec: true,
  releaseDate: true,
  isFeatured: true,
  playCount: true,
  likeCount: true,
  artwork: { select: MEDIA_IMAGE_SELECT },
  persona: { select: { slug: true } },
} as const;

const INCLUDE_FRAGMENTS = {
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

@Injectable()
export class PlaylistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = {
      cover: { select: MEDIA_IMAGE_SELECT },
      persona: { select: { slug: true } },
      _count: { select: { tracks: true } },
    };

    for (const key of include) {
      const fragment = (INCLUDE_FRAGMENTS as Record<string, object | undefined>)[key];
      if (fragment) Object.assign(base, fragment);
    }

    return base;
  }

  /** The ordered track list, always included for a Detail response. */
  private readonly TRACKS_INCLUDE = {
    tracks: {
      orderBy: { sortIndex: 'asc' },
      select: { note: true, track: { select: TRACK_SUMMARY_SELECT } },
    },
  } as const;

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublished(options: {
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.playlist.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
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
    return this.prisma.client.playlist.findFirst({
      where: { slug, ...publishedWhere() },
      include: { ...this.buildInclude(include), ...this.TRACKS_INCLUDE },
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.playlist.findMany({
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
      this.prisma.client.playlist.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: { ...this.buildInclude(['seo']), ...this.TRACKS_INCLUDE },
      }),
      this.prisma.client.playlist.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.playlist.findUnique({
      where: { id },
      include: { ...this.buildInclude(['seo']), ...this.TRACKS_INCLUDE },
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.playlist.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.PlaylistUncheckedCreateInput) {
    return this.prisma.client.playlist.create({
      data,
      include: { ...this.buildInclude(['seo']), ...this.TRACKS_INCLUDE },
    });
  }

  async update(id: string, data: Prisma.PlaylistUncheckedUpdateInput) {
    return this.prisma.client.playlist.update({
      where: { id },
      data,
      include: { ...this.buildInclude(['seo']), ...this.TRACKS_INCLUDE },
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.playlist.update({
      where: { id },
      data,
      include: { ...this.buildInclude(['seo']), ...this.TRACKS_INCLUDE },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.playlist.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.playlist.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: { ...this.buildInclude(['seo']), ...this.TRACKS_INCLUDE },
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.playlist.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }

  /**
   * Replaces the ordered track list wholesale, and **recomputes
   * `totalDurationSec`** in the same transaction.
   *
   * The duration is denormalised on the playlist row precisely so a list view
   * never has to aggregate every track's length — which means it has to be
   * kept correct at every write that can change the set, not just at read
   * time. A track with no known duration contributes 0 rather than being
   * skipped, so the total is a floor, never an overstatement.
   */
  async setTracks(playlistId: string, trackIds: string[]): Promise<void> {
    const tracks = await this.prisma.client.track.findMany({
      where: { id: { in: trackIds } },
      select: { id: true, durationSec: true },
    });

    const durationById = new Map(tracks.map((track) => [track.id, track.durationSec ?? 0]));
    const totalDurationSec = trackIds.reduce((sum, id) => sum + (durationById.get(id) ?? 0), 0);

    await this.prisma.client.$transaction([
      this.prisma.client.playlistTrack.deleteMany({ where: { playlistId } }),
      this.prisma.client.playlistTrack.createMany({
        data: trackIds
          // Silently drop an id that does not resolve to a real track, rather
          // than failing the whole write — a stale id in the array (a track
          // deleted between form-load and submit) should not block saving the
          // rest of the reorder.
          .filter((id) => durationById.has(id))
          .map((trackId, index) => ({ playlistId, trackId, sortIndex: index })),
      }),
      this.prisma.client.playlist.update({
        where: { id: playlistId },
        data: { totalDurationSec },
      }),
    ]);
  }
}
