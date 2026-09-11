import { Injectable } from '@nestjs/common';

import { Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

const COUNT_SELECT = { _count: { select: { posts: true } } } as const;

/**
 * Tag data access.
 *
 * A taxonomy, like `Genre`: no `status`, and `delete` is a real DELETE —
 * `PostTag` cascades, so the service refuses when a tag is still in use.
 */
@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { q?: string | undefined; keyset?: Record<string, unknown> | undefined; take: number }) {
    return this.prisma.client.tag.findMany({
      where: {
        ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: { name: 'asc' },
      take: options.take,
      include: COUNT_SELECT,
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.client.tag.findUnique({ where: { slug } });
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.tag.findUnique({ where: { id }, include: COUNT_SELECT });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.tag.findUnique({ where: { slug }, select: { id: true } });
    return existing != null && existing.id !== exceptId;
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.tag.findUnique({ where: { name }, select: { id: true } });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.TagUncheckedCreateInput) {
    return this.prisma.client.tag.create({ data, include: COUNT_SELECT });
  }

  async update(id: string, data: Prisma.TagUncheckedUpdateInput) {
    return this.prisma.client.tag.update({ where: { id }, data, include: COUNT_SELECT });
  }

  async countPosts(id: string): Promise<number> {
    return this.prisma.client.postTag.count({ where: { tagId: id } });
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.client.tag.delete({ where: { id } });
  }
}
