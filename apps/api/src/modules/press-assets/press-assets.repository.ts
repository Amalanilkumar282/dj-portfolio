import { Injectable } from '@nestjs/common';

import { ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE = {
  media: {
    select: {
      publicId: true,
      resourceType: true,
      format: true,
      secureUrl: true,
      width: true,
      height: true,
      altText: true,
      blurDataUrl: true,
      dominantColor: true,
      focalX: true,
      focalY: true,
    },
  },
  persona: { select: { slug: true } },
} as const;

@Injectable()
export class PressAssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    kind?: string | undefined;
    personaSlug?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.pressAsset.findMany({
      where: {
        ...publishedWhere(),
        ...(options.kind ? { kind: options.kind as never } : {}),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: INCLUDE,
    });
  }

  async listForAdmin(options: {
    status?: ContentStatus | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = options.status ? { status: options.status } : {};

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.pressAsset.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: INCLUDE,
      }),
      this.prisma.client.pressAsset.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.pressAsset.findUnique({ where: { id }, include: INCLUDE });
  }

  /** For the PDF regenerator: the most recent EPK for a persona, if any. */
  async findLatestByKindAndPersona(kind: string, personaId: string) {
    return this.prisma.client.pressAsset.findFirst({
      where: { kind: kind as never, personaId },
      orderBy: { version: 'desc' },
      include: INCLUDE,
    });
  }

  async create(data: Prisma.PressAssetUncheckedCreateInput) {
    return this.prisma.client.pressAsset.create({ data, include: INCLUDE });
  }

  async update(id: string, data: Prisma.PressAssetUncheckedUpdateInput) {
    return this.prisma.client.pressAsset.update({ where: { id }, data, include: INCLUDE });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.pressAsset.update({ where: { id }, data, include: INCLUDE });
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await this.prisma.client.pressAsset.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.pressAsset.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.pressAsset.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.pressAsset.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
