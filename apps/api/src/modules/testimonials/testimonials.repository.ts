import { Injectable } from '@nestjs/common';

import { ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE = {
  avatar: { select: MEDIA_IMAGE_SELECT },
  persona: { select: { slug: true } },
} as const;

@Injectable()
export class TestimonialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(options: {
    personaSlug?: string | undefined;
    featured?: boolean | undefined;
    verifiedOnly?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.testimonial.findMany({
      where: {
        ...publishedWhere(),
        ...(options.personaSlug ? { persona: { slug: options.personaSlug } } : {}),
        ...(options.featured ? { isFeatured: true } : {}),
        ...(options.verifiedOnly ? { isVerified: true } : {}),
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
      ...(options.q ? { authorName: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.testimonial.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: INCLUDE,
      }),
      this.prisma.client.testimonial.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.testimonial.findUnique({ where: { id }, include: INCLUDE });
  }

  async create(data: Prisma.TestimonialUncheckedCreateInput) {
    return this.prisma.client.testimonial.create({ data, include: INCLUDE });
  }

  async update(id: string, data: Prisma.TestimonialUncheckedUpdateInput) {
    return this.prisma.client.testimonial.update({ where: { id }, data, include: INCLUDE });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.testimonial.update({ where: { id }, data, include: INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.testimonial.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.testimonial.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: INCLUDE,
    });
  }

  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.testimonial.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
