import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE = {
  persona: { select: { slug: true, key: true } },
  items: {
    orderBy: { sortIndex: 'asc' as const },
    include: { media: { select: MEDIA_IMAGE_SELECT } },
  },
} as const;

@Injectable()
export class GalleriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    personaSlug?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.gallery.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: INCLUDE,
    });
  }

  async findPublishedBySlug(slug: string) {
    return this.prisma.client.gallery.findFirst({
      where: { slug, ...publishedWhere() },
      include: INCLUDE,
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
      this.prisma.client.gallery.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: INCLUDE,
      }),
      this.prisma.client.gallery.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.gallery.findUnique({ where: { id }, include: INCLUDE });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.gallery.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.GalleryUncheckedCreateInput) {
    return this.prisma.client.gallery.create({ data, include: INCLUDE });
  }

  async update(id: string, data: Prisma.GalleryUncheckedUpdateInput) {
    return this.prisma.client.gallery.update({ where: { id }, data, include: INCLUDE });
  }

  /**
   * A full replace, in one transaction — see `GalleryCreateInput.items`'s own
   * comment for why this is simpler and safer than add/remove/reorder
   * endpoints for a collection that is, in practice, always re-ordered as a
   * whole rather than patched one item at a time.
   */
  async replaceItems(
    galleryId: string,
    items: { mediaId: string; caption?: string | null | undefined; isCover?: boolean | undefined }[],
  ): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.galleryItem.deleteMany({ where: { galleryId } }),
      this.prisma.client.galleryItem.createMany({
        data: items.map((item, index) => ({
          galleryId,
          mediaId: item.mediaId,
          caption: item.caption ?? null,
          isCover: item.isCover ?? false,
          sortIndex: index,
        })),
        skipDuplicates: true,
      }),
    ]);
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
    return this.prisma.client.gallery.update({ where: { id }, data, include: INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.gallery.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.gallery.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.gallery.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
