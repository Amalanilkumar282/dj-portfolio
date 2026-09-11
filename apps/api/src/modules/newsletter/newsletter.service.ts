import { createHash, randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { NewsletterSubscriberAdminDetail, NewsletterSubscribeInput } from '@dj/contracts';
import { AuditAction, SubscriberStatus } from '@dj/db';

import { ERROR_CODES } from '../../common/problems';
import { RequestContextService } from '../../common/services/request-context.service';
import type { Env } from '../../config/env.schema';
import { MailService } from '../../infra/mail/mail.service';
import { newsletterConfirm } from '../../infra/mail/templates';
import { AuditService } from '../audit/audit.service';

import { toSubscriberAdminDetail } from './newsletter.mapper';
import { NewsletterRepository } from './newsletter.repository';

const CONFIRM_TOKEN_TTL_HOURS = 72;

/**
 * Double opt-in only. A subscriber is never mailed before confirming — see
 * docs/02-architecture/backend.md — which keeps deliverability and consent
 * both defensible.
 */
@Injectable()
export class NewsletterService {
  private readonly webBaseUrl: string;
  private readonly hashSalt: string;

  constructor(
    private readonly repository: NewsletterRepository,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly context: RequestContextService,
    config: ConfigService<Env, true>,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
    this.hashSalt = config.get('ANALYTICS_HASH_SALT', { infer: true });
  }

  async subscribe(input: NewsletterSubscribeInput, now: Date): Promise<void> {
    const existing = await this.repository.findByEmail(input.email);

    if (existing?.status === SubscriberStatus.CONFIRMED) {
      // Already subscribed: return quietly rather than 409 — a repeat
      // signup on a form the visitor forgot they already used is not an
      // error, and confirming that an email exists to a possibly-different
      // person is exactly the enumeration this response avoids.
      return;
    }

    const confirmToken = randomBytes(32).toString('base64url');
    const confirmTokenExpires = new Date(now.getTime() + CONFIRM_TOKEN_TTL_HOURS * 60 * 60 * 1000);
    const ip = this.context.get()?.ip;
    const ipHash = ip ? createHash('sha256').update(`${this.hashSalt}:${ip}`).digest('hex') : null;

    const subscriber = existing
      ? await this.repository.update(existing.id, {
          name: input.name ?? existing.name,
          confirmToken,
          confirmTokenExpires,
        })
      : await this.repository.create({
          email: input.email,
          name: input.name ?? null,
          status: SubscriberStatus.PENDING,
          confirmToken,
          confirmTokenExpires,
          unsubscribeToken: randomBytes(32).toString('base64url'),
          source: input.source ?? null,
          ipHash,
        });

    await this.audit.record({
      action: AuditAction.CREATE,
      entityType: 'NewsletterSubscriber',
      entityId: subscriber.id,
      metadata: { pending: true },
    });

    const confirmUrl = `${this.webBaseUrl}/newsletter/confirm?token=${confirmToken}`;
    const template = newsletterConfirm({ confirmUrl });

    await this.mail.send({
      to: subscriber.email,
      subject: 'Confirm your subscription',
      ...template,
    });
  }

  async confirm(token: string, now: Date): Promise<void> {
    const subscriber = await this.repository.findByConfirmToken(token);

    if (!subscriber?.confirmTokenExpires || subscriber.confirmTokenExpires < now) {
      throw new NotFoundException({
        message: 'This confirmation link is invalid or has expired.',
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    await this.repository.update(subscriber.id, {
      status: SubscriberStatus.CONFIRMED,
      confirmedAt: now,
      confirmToken: null,
      confirmTokenExpires: null,
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: 'NewsletterSubscriber',
      entityId: subscriber.id,
      metadata: { confirmed: true },
    });
  }

  async unsubscribe(token: string, now: Date): Promise<void> {
    const subscriber = await this.repository.findByUnsubscribeToken(token);

    if (!subscriber) {
      throw new NotFoundException({
        message: 'No subscription found for this link.',
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    await this.repository.update(subscriber.id, {
      status: SubscriberStatus.UNSUBSCRIBED,
      unsubscribedAt: now,
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: 'NewsletterSubscriber',
      entityId: subscriber.id,
      metadata: { unsubscribed: true },
    });
  }

  async listAdmin(query: {
    status?: string | undefined;
    q?: string | undefined;
    perPage: number;
    page: number;
  }): Promise<{
    data: NewsletterSubscriberAdminDetail[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { rows, total } = await this.repository.listForAdmin({
      status: query.status,
      q: query.q,
      orderBy: [{ createdAt: 'desc' }],
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toSubscriberAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }
}
