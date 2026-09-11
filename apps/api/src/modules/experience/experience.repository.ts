import { Injectable } from '@nestjs/common';

import { ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const LOGO_INCLUDE = { logo: { select: MEDIA_IMAGE_SELECT } } as const;

@Injectable()
export class ExperienceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    current?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.experienceEntry.findMany({
      where: {
        ...publishedWhere(),
        ...(options.current !== undefined ? { isCurrent: options.current } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: LOGO_INCLUDE,
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
              { role: { contains: options.q, mode: 'insensitive' as const } },
              { organisation: { contains: options.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.experienceEntry.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: LOGO_INCLUDE,
      }),
      this.prisma.client.experienceEntry.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.experienceEntry.findUnique({ where: { id }, include: LOGO_INCLUDE });
  }

  async create(data: Prisma.ExperienceEntryUncheckedCreateInput) {
    return this.prisma.client.experienceEntry.create({ data, include: LOGO_INCLUDE });
  }

  async update(id: string, data: Prisma.ExperienceEntryUncheckedUpdateInput) {
    return this.prisma.client.experienceEntry.update({ where: { id }, data, include: LOGO_INCLUDE });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.experienceEntry.update({ where: { id }, data, include: LOGO_INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.experienceEntry.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.experienceEntry.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: LOGO_INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.experienceEntry.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
