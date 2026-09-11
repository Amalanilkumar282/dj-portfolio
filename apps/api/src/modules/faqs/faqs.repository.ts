import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

const PERSONA_SELECT = { persona: { select: { slug: true } } } as const;
const SERVICE_SELECT = { service: { select: { slug: true } } } as const;

@Injectable()
export class FaqsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublished(options: {
    category?: string | undefined;
    personaSlug?: string | undefined;
    serviceSlug?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.faq.findMany({
      where: {
        ...publishedWhere(),
        ...(options.category ? { category: options.category } : {}),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.serviceSlug ? { service: { slug: options.serviceSlug } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: { ...PERSONA_SELECT, ...SERVICE_SELECT },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  async listForAdmin(options: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { question: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.faq.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: { ...PERSONA_SELECT, ...SERVICE_SELECT },
      }),
      this.prisma.client.faq.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.faq.findUnique({
      where: { id },
      include: { ...PERSONA_SELECT, ...SERVICE_SELECT },
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.faq.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null && existing.id !== exceptId;
  }

  async serviceExists(id: string): Promise<boolean> {
    return (await this.prisma.client.service.findUnique({ where: { id }, select: { id: true } })) != null;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.FaqUncheckedCreateInput) {
    return this.prisma.client.faq.create({ data, include: { ...PERSONA_SELECT, ...SERVICE_SELECT } });
  }

  async update(id: string, data: Prisma.FaqUncheckedUpdateInput) {
    return this.prisma.client.faq.update({
      where: { id },
      data,
      include: { ...PERSONA_SELECT, ...SERVICE_SELECT },
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.faq.update({
      where: { id },
      data,
      include: { ...PERSONA_SELECT, ...SERVICE_SELECT },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.faq.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.faq.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: { ...PERSONA_SELECT, ...SERVICE_SELECT },
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.faq.update({ where: { id: entry.id }, data: { sortIndex: entry.sortIndex } }),
      ),
    );
  }
}
