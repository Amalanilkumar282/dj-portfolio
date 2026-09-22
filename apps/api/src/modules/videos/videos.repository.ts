import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE = {
  persona: { select: { slug: true, key: true } },
  event: { select: { slug: true } },
  thumbnail: { select: MEDIA_IMAGE_SELECT },
  hostedMedia: { select: { secureUrl: true } },
} as const;

@Injectable()
export class VideosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    personaSlug?: string | undefined;
    eventSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.video.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.eventSlug ? { event: { slug: options.eventSlug } } : {}),
        ...(options.featured === undefined ? {} : { isFeatured: options.featured }),
        ...(options.q ? { title: { contains: options.q, mode: 'insensitive' as const } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: INCLUDE,
    });
  }

  async findPublishedBySlug(slug: string) {
    return this.prisma.client.video.findFirst({
      where: { slug, ...publishedWhere() },
      include: INCLUDE,
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.video.findMany({
      where: publishedWhere(),
      orderBy: { sortIndex: 'asc' },
      select: { slug: true, updatedAt: true },
    });
  }

  async listForAdmin(options: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { title: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.video.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: INCLUDE,
      }),
      this.prisma.client.video.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.video.findUnique({ where: { id }, include: INCLUDE });
  }

  /**
   * `anyDeletionState()` is load-bearing, not defensive: the soft-delete
   * extension narrows a plain lookup to `deletedAt: null`, so without it a
   * slug held by a soft-deleted row reads as free and the auto-generated
   * slug path hands back one the unique index then rejects. See ADR 0020.
   */
  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.video.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.VideoUncheckedCreateInput) {
    return this.prisma.client.video.create({ data, include: INCLUDE });
  }

  async update(id: string, data: Prisma.VideoUncheckedUpdateInput) {
    return this.prisma.client.video.update({ where: { id }, data, include: INCLUDE });
  }

  async resolvePersonaId(personaKey: string | null): Promise<string | null> {
    if (!personaKey) return null;
    const persona = await this.prisma.client.persona.findUnique({
      where: { key: personaKey as never },
      select: { id: true },
    });
    return persona?.id ?? null;
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.video.update({ where: { id }, data, include: INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.video.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.video.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.video.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
