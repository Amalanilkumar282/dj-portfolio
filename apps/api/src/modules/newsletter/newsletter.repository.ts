import { Injectable } from '@nestjs/common';

import { Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class NewsletterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.client.newsletterSubscriber.findUnique({ where: { email } });
  }

  async findByConfirmToken(token: string) {
    return this.prisma.client.newsletterSubscriber.findUnique({ where: { confirmToken: token } });
  }

  async findByUnsubscribeToken(token: string) {
    return this.prisma.client.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
  }

  async create(data: Prisma.NewsletterSubscriberUncheckedCreateInput) {
    return this.prisma.client.newsletterSubscriber.create({ data });
  }

  async update(id: string, data: Prisma.NewsletterSubscriberUncheckedUpdateInput) {
    return this.prisma.client.newsletterSubscriber.update({ where: { id }, data });
  }

  async listForAdmin(options: {
    status?: string | undefined;
    q?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status as never } : {}),
      ...(options.q ? { email: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.newsletterSubscriber.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
      }),
      this.prisma.client.newsletterSubscriber.count({ where }),
    ]);

    return { rows, total };
  }
}
