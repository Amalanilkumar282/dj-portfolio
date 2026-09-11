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
  trackNumber: true,
  artwork: { select: MEDIA_IMAGE_SELECT },
  persona: { select: { slug: true } },
} as const;

const INCLUDE_FRAGMENTS = {
  tracks: {
    tracks: { orderBy: { trackNumber: 'asc' }, select: TRACK_SUMMARY_SELECT },
  },
  streamLinks: {
    streamLinks: { orderBy: { sortIndex: 'asc' }, select: { platform: true, url: true } },
  },
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

@Injectable()
export class ReleasesRepository {
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

  private fullInclude(): Record<string, unknown> {
    return this.buildInclude(['tracks', 'streamLinks', 'seo']);
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublished(options: {
    personaSlug?: string | undefined;
    type?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.release.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.type ? { type: options.type as Prisma.EnumReleaseTypeFilter } : {}),
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
    return this.prisma.client.release.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(['tracks', 'streamLinks', ...include]),
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.release.findMany({
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
      this.prisma.client.release.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.fullInclude(),
      }),
      this.prisma.client.release.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.release.findUnique({
      where: { id },
      include: this.fullInclude(),
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.release.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.ReleaseUncheckedCreateInput) {
    return this.prisma.client.release.create({ data, include: this.fullInclude() });
  }

  async update(id: string, data: Prisma.ReleaseUncheckedUpdateInput) {
    return this.prisma.client.release.update({ where: { id }, data, include: this.fullInclude() });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.release.update({ where: { id }, data, include: this.fullInclude() });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.release.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.release.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.fullInclude(),
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.release.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
