import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const IMAGE_INCLUDE = { image: { select: MEDIA_IMAGE_SELECT } } as const;

@Injectable()
export class GearRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    category?: string | undefined;
    riderOnly?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.gearItem.findMany({
      where: {
        ...publishedWhere(),
        ...(options.category ? { category: options.category as never } : {}),
        ...(options.riderOnly ? { isRiderItem: true } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: IMAGE_INCLUDE,
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
      ...(options.q
        ? {
            OR: [
              { brand: { contains: options.q, mode: 'insensitive' as const } },
              { model: { contains: options.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.gearItem.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: IMAGE_INCLUDE,
      }),
      this.prisma.client.gearItem.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.gearItem.findUnique({ where: { id }, include: IMAGE_INCLUDE });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.gearItem.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.GearItemUncheckedCreateInput) {
    return this.prisma.client.gearItem.create({ data, include: IMAGE_INCLUDE });
  }

  async update(id: string, data: Prisma.GearItemUncheckedUpdateInput) {
    return this.prisma.client.gearItem.update({ where: { id }, data, include: IMAGE_INCLUDE });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.gearItem.update({ where: { id }, data, include: IMAGE_INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.gearItem.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.gearItem.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: IMAGE_INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.gearItem.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
