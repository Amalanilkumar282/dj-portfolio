import { Injectable } from '@nestjs/common';

import { Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

const PERSONA_INCLUDE = { persona: { select: { slug: true } } } as const;

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: {
    personaSlug?: string | undefined;
    visibleOnly?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.stat.findMany({
      where: {
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.visibleOnly ? { isVisible: true } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: PERSONA_INCLUDE,
    });
  }

  async listForAdmin(options: {
    q?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = options.q
      ? {
          OR: [
            { key: { contains: options.q, mode: 'insensitive' as const } },
            { label: { contains: options.q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.stat.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: PERSONA_INCLUDE,
      }),
      this.prisma.client.stat.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.stat.findUnique({ where: { id }, include: PERSONA_INCLUDE });
  }

  /**
   * `@@unique([personaId, key])` does not catch two global stats (both
   * `personaId: null`) sharing a key — Postgres treats NULL as distinct in a
   * unique index, so the DB constraint is silent about exactly the case a
   * site-wide stat like `gigs_played` needs guarded.
   */
  async isKeyTaken(key: string, personaId: string | null, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.stat.findFirst({
      where: { key, personaId },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async create(data: Prisma.StatUncheckedCreateInput) {
    return this.prisma.client.stat.create({ data, include: PERSONA_INCLUDE });
  }

  async update(id: string, data: Prisma.StatUncheckedUpdateInput) {
    return this.prisma.client.stat.update({ where: { id }, data, include: PERSONA_INCLUDE });
  }

  /** A genuine hard delete — `Stat` has no `deletedAt`. Nothing else references it. */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.client.stat.delete({ where: { id } });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.stat.update({ where: { id: entry.id }, data: { sortIndex: entry.sortIndex } }),
      ),
    );
  }
}
