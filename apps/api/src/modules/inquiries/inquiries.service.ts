import { createHash } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  BookingInquiryAdminDetail,
  BookingInquiryCreateInput,
  BookingInquiryPublicResult,
  InquiryNoteCreateInput,
  InquiryUpdateInput,
} from '@dj/contracts';
import { AuditAction, InquiryStatus, InquirySource } from '@dj/db';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { ERROR_CODES } from '../../common/problems';
import { RequestContextService } from '../../common/services/request-context.service';
import type { Env } from '../../config/env.schema';
import { AuditService } from '../audit/audit.service';
import { PersonasService } from '../personas/personas.service';

import { toInquiryAdminDetail } from './inquiries.mapper';
import { InquiriesRepository } from './inquiries.repository';

/** Emitted after a successful create; `InquiryMailListener` sends the two emails. */
export const INQUIRY_CREATED = 'inquiry.created';

export interface InquiryCreatedEvent {
  inquiryId: string;
}

const MAX_REFERENCE_ATTEMPTS = 5;
/** Links, ALL-CAPS ratio and a small disposable-domain list — enough signal
 * at this submission volume without pulling in a spam-scoring dependency. */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'trashmail.com',
]);

@Injectable()
export class InquiriesService {
  private readonly hashSalt: string;

  constructor(
    private readonly repository: InquiriesRepository,
    private readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
    private readonly context: RequestContextService,
    private readonly personas: PersonasService,
    config: ConfigService<Env, true>,
  ) {
    this.hashSalt = config.get('ANALYTICS_HASH_SALT', { infer: true });
  }

  /** The public booking form. Writes and returns fast; mail is fire-and-forget. */
  async submit(input: BookingInquiryCreateInput, now: Date): Promise<BookingInquiryPublicResult> {
    const ctx = this.context.get();
    const personaId = await this.resolvePersonaId(input.personaKey);

    const spam = this.scoreSpam(input);
    const reference = await this.generateReference(now);

    const created = await this.repository.create({
      reference,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      ...(input.preferredChannel === undefined ? {} : { preferredChannel: input.preferredChannel }),
      eventType: input.eventType ?? 'PRIVATE',
      eventDate: input.eventDate ?? null,
      eventEndDate: input.eventEndDate ?? null,
      isDateFlexible: input.isDateFlexible ?? false,
      venueText: input.venueText ?? null,
      city: input.city ?? null,
      ...(input.country === undefined ? {} : { country: input.country }),
      guestCount: input.guestCount ?? null,
      durationHours: input.durationHours ?? null,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      ...(input.currency === undefined ? {} : { currency: input.currency }),
      ...(personaId ? { personaId } : {}),
      serviceSlug: input.serviceSlug ?? null,
      message: input.message ?? null,
      status: spam.isSpam ? InquiryStatus.SPAM : InquiryStatus.NEW,
      source: InquirySource.WEBSITE_FORM,
      spamScore: spam.score,
      honeypotTripped: spam.honeypotTripped,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      referrerUrl: input.referrerUrl ?? null,
      landingPath: input.landingPath ?? null,
      ipHash: ctx?.ip ? this.hash(ctx.ip) : null,
      userAgent: ctx?.userAgent ?? null,
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entityType: 'BookingInquiry',
      entityId: created.id,
      metadata: { reference, spamScore: spam.score },
    });

    if (!spam.isSpam) {
      // Fired, not awaited: the response must not wait on Resend. The
      // listener stamps notifiedAt/autoRespondedAt itself once mail sends.
      this.events.emit(INQUIRY_CREATED, { inquiryId: created.id } satisfies InquiryCreatedEvent);
    }

    return {
      reference: created.reference,
      whatsappUrl: this.whatsappUrl(created.phone, created.reference),
    };
  }

  async listAdmin(query: {
    status?: string | undefined;
    q?: string | undefined;
    assignedToId?: string | undefined;
    perPage: number;
    page: number;
  }): Promise<{ data: BookingInquiryAdminDetail[]; total: number; page: number; totalPages: number }> {
    const { rows, total } = await this.repository.listForAdmin({
      status: query.status,
      q: query.q,
      assignedToId: query.assignedToId,
      orderBy: [{ createdAt: 'desc' }],
      take: query.perPage,
      skip: (query.page - 1) * query.perPage,
    });

    return {
      data: rows.map(toInquiryAdminDetail),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findAdminById(id: string): Promise<BookingInquiryAdminDetail> {
    return toInquiryAdminDetail(await this.loadForAdmin(id));
  }

  async update(id: string, input: InquiryUpdateInput): Promise<BookingInquiryAdminDetail> {
    await this.loadForAdmin(id);

    const updated = await this.repository.update(id, {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.assignedToId === undefined ? {} : { assignedToId: input.assignedToId }),
      ...(input.quotedAmount === undefined ? {} : { quotedAmount: input.quotedAmount }),
      ...(input.lostReason === undefined ? {} : { lostReason: input.lostReason }),
      ...(input.budgetMin === undefined ? {} : { budgetMin: input.budgetMin }),
      ...(input.budgetMax === undefined ? {} : { budgetMax: input.budgetMax }),
      ...(input.eventDate === undefined ? {} : { eventDate: input.eventDate }),
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entityType: 'BookingInquiry',
      entityId: id,
      metadata: { changed: Object.keys(input) },
    });

    return toInquiryAdminDetail(updated);
  }

  async addNote(id: string, input: InquiryNoteCreateInput): Promise<BookingInquiryAdminDetail> {
    await this.loadForAdmin(id);

    const actorId = this.context.userId ?? null;
    const updated = await this.repository.addNote(id, actorId, input.body);

    await this.audit.record({ action: AuditAction.UPDATE, entityType: 'BookingInquiry', entityId: id });

    if (!updated) {
      throw new NotFoundException({
        message: `No inquiry exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    return toInquiryAdminDetail(updated);
  }

  async remove(id: string): Promise<void> {
    await this.loadForAdmin(id);
    await this.repository.softDelete(id);
    await this.audit.record({ action: AuditAction.DELETE, entityType: 'BookingInquiry', entityId: id });
  }

  private async resolvePersonaId(
    personaKey: BookingInquiryCreateInput['personaKey'],
  ): Promise<string | undefined> {
    if (!personaKey) return undefined;
    const persona = await this.personas.findIdByKey(personaKey);
    return persona?.id;
  }

  private async generateReference(now: Date): Promise<string> {
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const candidate = await this.repository.nextReference(now);
      if (!(await this.repository.isReferenceTaken(candidate))) return candidate;
    }
    // Astronomically unlikely at this submission volume, but a clear error
    // beats a P2002 that reads like an unrelated bug.
    throw new Error('Could not generate a unique inquiry reference after several attempts.');
  }

  private hash(value: string): string {
    return createHash('sha256').update(`${this.hashSalt}:${value}`).digest('hex');
  }

  private scoreSpam(input: BookingInquiryCreateInput): {
    score: number;
    isSpam: boolean;
    honeypotTripped: boolean;
  } {
    let score = 0;
    const honeypotTripped = Boolean(input.website && input.website.trim().length > 0);
    if (honeypotTripped) score += 100;

    const message = input.message ?? '';
    const linkCount = (message.match(/https?:\/\//gi) ?? []).length;
    score += Math.min(linkCount * 15, 45);

    const letters = message.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 20) {
      const upperRatio = (letters.match(/[A-Z]/g) ?? []).length / letters.length;
      if (upperRatio > 0.7) score += 20;
    }

    const domain = input.email.split('@')[1]?.toLowerCase();
    if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) score += 40;

    return { score, isSpam: score >= 60, honeypotTripped };
  }

  private whatsappUrl(phone: string | null, reference: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^\d]/g, '');
    if (!digits) return null;
    const text = encodeURIComponent(`Hi! Following up on booking enquiry ${reference}.`);
    return `https://wa.me/${digits}?text=${text}`;
  }

  private async loadForAdmin(id: string) {
    const row = await this.repository.findByIdForAdmin(id);
    if (!row) {
      throw new NotFoundException({
        message: `No inquiry exists with id "${id}".`,
        code: ERROR_CODES.NOT_FOUND,
      });
    }
    return row;
  }
}
