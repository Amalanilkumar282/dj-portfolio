import { Injectable } from '@nestjs/common';

import { type AuditAction, Prisma } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditWrite {
  action: AuditAction;
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorId?: string | undefined;
  actorEmail?: string | undefined;
  diff?: unknown;
  metadata?: unknown;
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface AuditQuery {
  entityType?: string | undefined;
  entityId?: string | undefined;
  actorId?: string | undefined;
  action?: AuditAction | undefined;
  take: number;
  cursor?: string | undefined;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(write: AuditWrite): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        action: write.action,
        entityType: write.entityType ?? null,
        entityId: write.entityId ?? null,
        actorId: write.actorId ?? null,
        // Denormalised so the trail survives the actor being deleted.
        actorEmail: write.actorEmail ?? null,
        diff: (write.diff ?? null) as Prisma.InputJsonValue,
        metadata: (write.metadata ?? null) as Prisma.InputJsonValue,
        ip: write.ip ?? null,
        userAgent: write.userAgent ?? null,
        requestId: write.requestId ?? null,
      },
    });
  }

  async list(query: AuditQuery) {
    return this.prisma.client.auditLog.findMany({
      where: {
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.action ? { action: query.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
    });
  }
}
