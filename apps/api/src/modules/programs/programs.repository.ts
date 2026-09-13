import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT, SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE_FRAGMENTS = {
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

@Injectable()
export class ProgramsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = {
      hero: { select: MEDIA_IMAGE_SELECT },
      persona: { select: { slug: true } },
      venue: { select: { name: true, slug: true } },
      _count: { select: { events: true } },
    };

    for (const key of include) {
      const fragment = (INCLUDE_FRAGMENTS as Record<string, object | undefined>)[key];
      if (fragment) Object.assign(base, fragment);
    }

    return base;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublished(options: {
    personaSlug?: string | undefined;
    venueSlug?: string | undefined;
    ongoing?: boolean | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.program.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.venueSlug ? { venue: { slug: options.venueSlug } } : {}),
        ...(options.ongoing === undefined ? {} : { isOngoing: options.ongoing }),
        ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: this.buildInclude(options.include),
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.program.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(include),
    });
  }

  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.program.findMany({
      where: publishedWhere(),
      orderBy: { sortIndex: 'asc' },
      select: { slug: true, updatedAt: true },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  async listForAdmin(options: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    personaSlug?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.program.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.buildInclude(['seo']),
      }),
      this.prisma.client.program.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.program.findUnique({
      where: { id },
      include: this.buildInclude(['seo']),
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.program.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.ProgramUncheckedCreateInput) {
    return this.prisma.client.program.create({ data, include: this.buildInclude(['seo']) });
  }

  async update(id: string, data: Prisma.ProgramUncheckedUpdateInput) {
    return this.prisma.client.program.update({
      where: { id },
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.program.update({
      where: { id },
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.program.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.program.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.buildInclude(['seo']),
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.program.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
