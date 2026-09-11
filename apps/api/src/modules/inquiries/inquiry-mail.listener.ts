import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

import { AuditAction } from '@dj/db';

import type { Env } from '../../config/env.schema';
import { MailService } from '../../infra/mail/mail.service';
import { bookingInquiryAutoresponder, bookingInquiryNotification } from '../../infra/mail/templates';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';

import { InquiriesRepository } from './inquiries.repository';
import { INQUIRY_CREATED, type InquiryCreatedEvent } from './inquiries.service';

/**
 * Sends the two booking-inquiry emails.
 *
 * Registered via `@OnEvent` rather than awaited inline in
 * `InquiriesService.submit()`, so `POST /inquiries` writes the row and
 * returns without waiting on Resend — a slow or down mail provider must
 * never turn a 40ms write into a multi-second request. `notifiedAt` staying
 * null on failure is what the retry cron (`InquiryRetryMailCron`) scans on.
 */
@Injectable()
export class InquiryMailListener {
  private readonly logger = new Logger(InquiryMailListener.name);
  private readonly notifyTo: string;

  constructor(
    private readonly repository: InquiriesRepository,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.notifyTo = config.get('BOOKING_NOTIFY_TO', { infer: true });
  }

  @OnEvent(INQUIRY_CREATED)
  async onInquiryCreated(event: InquiryCreatedEvent): Promise<void> {
    const inquiry = await this.repository.findByIdForAdmin(event.inquiryId);
    if (!inquiry) return;

    const notification = bookingInquiryNotification({
      reference: inquiry.reference,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      eventType: inquiry.eventType,
      eventDate: inquiry.eventDate,
      city: inquiry.city,
      personaLabel: inquiry.persona?.slug ?? null,
      budgetMin: inquiry.budgetMin == null ? null : Number(inquiry.budgetMin),
      budgetMax: inquiry.budgetMax == null ? null : Number(inquiry.budgetMax),
      message: inquiry.message,
    });

    const notifySent = await this.mail.send({
      to: this.notifyTo,
      subject: `New enquiry ${inquiry.reference} — ${inquiry.name}`,
      replyTo: inquiry.email,
      ...notification,
    });

    const settings = await this.settings.getPublic();
    const autoresponder = bookingInquiryAutoresponder({
      name: inquiry.name,
      reference: inquiry.reference,
      responseTimePromise: settings.responseTimePromise ?? 'We reply within 24 hours',
      whatsappUrl: settings.whatsappNumber
        ? `https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}`
        : null,
    });

    const autoSent = await this.mail.send({
      to: inquiry.email,
      subject: `We've got your enquiry — ${inquiry.reference}`,
      ...autoresponder,
    });

    const now = new Date();
    await this.repository.update(inquiry.id, {
      ...(notifySent ? { notifiedAt: now } : {}),
      ...(autoSent ? { autoRespondedAt: now } : {}),
      ...(notifySent && autoSent ? {} : { mailFailureCount: { increment: 1 } }),
    });

    if (!notifySent || !autoSent) {
      this.logger.warn(
        `inquiry_mail_partial_failure reference=${inquiry.reference} notify=${String(notifySent)} auto=${String(autoSent)}`,
      );
      await this.audit.record({
        action: AuditAction.MAIL_FAILED,
        entityType: 'BookingInquiry',
        entityId: inquiry.id,
        metadata: { notifySent, autoSent },
      });
    }
  }
}
