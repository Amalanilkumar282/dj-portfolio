import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE_FRAGMENTS = {
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

const BASE_INCLUDE = {
  image: { select: MEDIA_IMAGE_SELECT },
  persona: { select: { slug: true } },
} as const;

@Injectable()
export class ServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = { ...BASE_INCLUDE };
    for (const key of include) {
      const fragment = (INCLUDE_FRAGMENTS as Record<string, object | undefined>)[key];
      if (fragment) Object.assign(base, fragment);
    }
    return base;
  }

  async listPublished(options: {
    category?: string | undefined;
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.service.findMany({
      where: {
        ...publishedWhere(),
        ...(options.category ? { category: options.category as never } : {}),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.featured ? { isFeatured: true } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: this.buildInclude(options.include),
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.service.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(include),
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.service.findMany({
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
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.service.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.buildInclude(['seo']),
      }),
      this.prisma.client.service.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.service.findUnique({
      where: { id },
      include: this.buildInclude(['seo']),
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.service.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.ServiceUncheckedCreateInput) {
    return this.prisma.client.service.create({ data, include: this.buildInclude(['seo']) });
  }

  async update(id: string, data: Prisma.ServiceUncheckedUpdateInput) {
    return this.prisma.client.service.update({
      where: { id },
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.service.update({
      where: { id },
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.service.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.service.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.buildInclude(['seo']),
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.service.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
