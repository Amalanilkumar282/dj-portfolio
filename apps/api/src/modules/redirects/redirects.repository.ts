import { Injectable } from '@nestjs/common';

import { Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class RedirectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Every active redirect, for the web middleware — cached there for an hour. */
  async listActive() {
    return this.prisma.client.redirect.findMany({
      where: { isActive: true },
      orderBy: { fromPath: 'asc' },
    });
  }

  async listForAdmin(options: {
    q?: string | undefined;
    activeOnly?: boolean | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.activeOnly ? { isActive: true } : {}),
      ...(options.q
        ? {
            OR: [
              { fromPath: { contains: options.q, mode: 'insensitive' as const } },
              { toPath: { contains: options.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.redirect.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
      }),
      this.prisma.client.redirect.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.redirect.findUnique({ where: { id } });
  }

  async isFromPathTaken(fromPath: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.redirect.findUnique({
      where: { fromPath },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.RedirectUncheckedCreateInput) {
    return this.prisma.client.redirect.create({ data });
  }

  async update(id: string, data: Prisma.RedirectUncheckedUpdateInput) {
    return this.prisma.client.redirect.update({ where: { id }, data });
  }

  /** A genuine hard delete — `Redirect` has no `deletedAt`, and nothing else references one. */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.client.redirect.delete({ where: { id } });
  }
}
