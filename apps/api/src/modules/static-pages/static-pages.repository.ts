import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const SEO_INCLUDE = { seoMeta: { select: SEO_SELECT } } as const;

@Injectable()
export class StaticPagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublishedBySlug(slug: string) {
    return this.prisma.client.staticPage.findFirst({
      where: { slug, ...publishedWhere() },
      include: SEO_INCLUDE,
    });
  }

  /** Slugs for the sitemap. */
  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.staticPage.findMany({
      where: publishedWhere(),
      orderBy: { slug: 'asc' },
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
      this.prisma.client.staticPage.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: SEO_INCLUDE,
      }),
      this.prisma.client.staticPage.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.staticPage.findUnique({ where: { id }, include: SEO_INCLUDE });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.staticPage.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.StaticPageUncheckedCreateInput) {
    return this.prisma.client.staticPage.create({ data, include: SEO_INCLUDE });
  }

  async update(id: string, data: Prisma.StaticPageUncheckedUpdateInput) {
    return this.prisma.client.staticPage.update({ where: { id }, data, include: SEO_INCLUDE });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.staticPage.update({ where: { id }, data, include: SEO_INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.staticPage.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.staticPage.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: SEO_INCLUDE,
    });
  }

  /**
   * `StaticPage` has no `sortIndex` column — it is never drag-reordered — so
   * this exists only to satisfy `PublishableRepository`. Never called: the
   * admin controller does not expose a `/reorder` route for this resource.
   */
  async reorder(_entries: { id: string; sortIndex: number }[]): Promise<void> {
    await Promise.resolve();
  }
}
