import { Injectable } from '@nestjs/common';

import { anyDeletionState, InquiryStatus, Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

const NOTES_INCLUDE = {
  notes: { orderBy: { createdAt: 'desc' as const }, include: { author: { select: { name: true } } } },
  persona: { select: { slug: true } },
} as const;

@Injectable()
export class InquiriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `INQ-YYYY-NNNN`, sequential within the year.
   *
   * Computed from the count of rows created since Jan 1, then retried by the
   * service on a unique-constraint conflict — two submissions in the same
   * millisecond are rare enough that optimistic generation plus retry beats
   * a dedicated sequence table for this volume.
   */
  async nextReference(now: Date): Promise<string> {
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const count = await this.prisma.client.bookingInquiry.count({
      where: { createdAt: { gte: yearStart }, ...anyDeletionState() },
    });
    const n = count + 1;
    return `INQ-${String(now.getUTCFullYear())}-${String(n).padStart(4, '0')}`;
  }

  async isReferenceTaken(reference: string): Promise<boolean> {
    const existing = await this.prisma.client.bookingInquiry.findUnique({
      where: { reference },
      select: { id: true },
    });
    return existing != null;
  }

  async create(data: Prisma.BookingInquiryUncheckedCreateInput) {
    return this.prisma.client.bookingInquiry.create({ data, include: NOTES_INCLUDE });
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.bookingInquiry.findUnique({ where: { id }, include: NOTES_INCLUDE });
  }

  async listForAdmin(options: {
    status?: string | undefined;
    q?: string | undefined;
    assignedToId?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status as never } : {}),
      ...(options.assignedToId ? { assignedToId: options.assignedToId } : {}),
      ...(options.q
        ? {
            OR: [
              { name: { contains: options.q, mode: 'insensitive' as const } },
              { email: { contains: options.q, mode: 'insensitive' as const } },
              { reference: { contains: options.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.bookingInquiry.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: NOTES_INCLUDE,
      }),
      this.prisma.client.bookingInquiry.count({ where }),
    ]);

    return { rows, total };
  }

  async update(id: string, data: Prisma.BookingInquiryUncheckedUpdateInput) {
    return this.prisma.client.bookingInquiry.update({ where: { id }, data, include: NOTES_INCLUDE });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.bookingInquiry.delete({ where: { id } });
  }

  async addNote(inquiryId: string, authorId: string | null, body: string) {
    await this.prisma.client.inquiryNote.create({ data: { inquiryId, authorId, body } });
    return this.findByIdForAdmin(inquiryId);
  }

  /** `notifiedAt IS NULL` means the notification never went out — the retry cron scans on this. */
  async listPendingNotification(createdAfter: Date, take = 50) {
    return this.prisma.client.bookingInquiry.findMany({
      where: {
        notifiedAt: null,
        createdAt: { gt: createdAfter },
        status: { notIn: [InquiryStatus.SPAM, InquiryStatus.ARCHIVED] },
      },
      take,
      include: NOTES_INCLUDE,
    });
  }
}
