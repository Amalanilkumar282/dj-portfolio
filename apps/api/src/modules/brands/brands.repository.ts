import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere, type PersonaKey } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE = {
  logo: { select: MEDIA_IMAGE_SELECT },
  logoMono: { select: MEDIA_IMAGE_SELECT },
  personas: { select: { persona: { select: { slug: true } } }, orderBy: { sortIndex: 'asc' as const } },
} as const;

@Injectable()
export class BrandsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.brand.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { personas: { some: { persona: { slug: options.personaSlug } } } } : {}),
        ...(options.featured ? { isFeatured: true } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
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
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.brand.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: INCLUDE,
      }),
      this.prisma.client.brand.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.brand.findUnique({ where: { id }, include: INCLUDE });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.brand.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.BrandUncheckedCreateInput) {
    return this.prisma.client.brand.create({ data, include: INCLUDE });
  }

  async update(id: string, data: Prisma.BrandUncheckedUpdateInput) {
    return this.prisma.client.brand.update({ where: { id }, data, include: INCLUDE });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.brand.update({ where: { id }, data, include: INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.brand.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.brand.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.brand.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }

  /** Replaces the persona associations wholesale, preserving the caller's order. */
  async setPersonas(brandId: string, personaKeys: PersonaKey[]): Promise<void> {
    const personas = await this.prisma.client.persona.findMany({
      where: { key: { in: personaKeys } },
      select: { id: true, key: true },
    });

    const ordered = personaKeys
      .map((key) => personas.find((p) => p.key === key))
      .filter((p): p is { id: string; key: PersonaKey } => p != null);

    await this.prisma.client.$transaction([
      this.prisma.client.personaBrand.deleteMany({ where: { brandId } }),
      this.prisma.client.personaBrand.createMany({
        data: ordered.map((persona, index) => ({
          brandId,
          personaId: persona.id,
          sortIndex: index,
        })),
        skipDuplicates: true,
      }),
    ]);
  }
}
