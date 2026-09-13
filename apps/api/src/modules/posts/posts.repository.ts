import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE_FRAGMENTS = { seo: { seoMeta: { select: SEO_SELECT } } } as const;

const BASE_INCLUDE = {
  cover: { select: MEDIA_IMAGE_SELECT },
  persona: { select: { slug: true } },
  tags: { include: { tag: true } },
} as const;

@Injectable()
export class PostsRepository {
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
    personaSlug?: string | undefined;
    tagSlug?: string | undefined;
    featured?: boolean | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.post.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.tagSlug ? { tags: { some: { tag: { slug: options.tagSlug } } } } : {}),
        ...(options.featured ? { isFeatured: true } : {}),
        ...(options.q ? { title: { contains: options.q, mode: 'insensitive' } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: this.buildInclude(options.include),
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.post.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(include),
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.post.findMany({
      where: publishedWhere(),
      orderBy: { publishedAt: 'desc' },
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
      this.prisma.client.post.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.buildInclude(['seo']),
      }),
      this.prisma.client.post.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.post.findUnique({ where: { id }, include: this.buildInclude(['seo']) });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.post.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.PostUncheckedCreateInput) {
    return this.prisma.client.post.create({ data, include: this.buildInclude(['seo']) });
  }

  async update(id: string, data: Prisma.PostUncheckedUpdateInput) {
    return this.prisma.client.post.update({ where: { id }, data, include: this.buildInclude(['seo']) });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.post.update({ where: { id }, data, include: this.buildInclude(['seo']) });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.post.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.post.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.buildInclude(['seo']),
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.post.update({ where: { id: entry.id }, data: { sortIndex: entry.sortIndex } }),
      ),
    );
  }

  /** Replaces the tag associations wholesale. */
  async setTags(postId: string, tagSlugs: string[]): Promise<void> {
    const tags = await this.prisma.client.tag.findMany({
      where: { slug: { in: tagSlugs } },
      select: { id: true },
    });

    await this.prisma.client.$transaction([
      this.prisma.client.postTag.deleteMany({ where: { postId } }),
      this.prisma.client.postTag.createMany({
        data: tags.map((tag) => ({ postId, tagId: tag.id })),
        skipDuplicates: true,
      }),
    ]);
  }
}
