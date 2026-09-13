import { z } from 'zod';

import { Id, PaginationSchema, Slug, inputObject, sortSchema } from './common.js';
import { CurrencySchema, EventKindSchema, PersonaKeySchema } from './content.js';

/**
 * Booking inquiries and the newsletter. The legacy `BookingModal` only called
 * `console.log` and `alert()`, so every inquiry ever submitted was silently
 * discarded — this is the fix. See docs/02-architecture/backend.md.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Booking inquiries
// ─────────────────────────────────────────────────────────────────────────────

export const InquiryStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUOTED',
  'NEGOTIATING',
  'BOOKED',
  'LOST',
  'SPAM',
  'ARCHIVED',
]);
export type InquiryStatus = z.infer<typeof InquiryStatusSchema>;

export const InquirySourceSchema = z.enum([
  'WEBSITE_FORM',
  'INSTAGRAM',
  'WHATSAPP',
  'REFERRAL',
  'EMAIL',
  'PHONE',
  'OTHER',
]);
export type InquirySource = z.infer<typeof InquirySourceSchema>;

/**
 * The public booking form. Deliberately narrow — no `status`, `source`,
 * `assignedToId` or any of the pipeline fields, all of which are set by the
 * server. A caller sending them would be silently ignored under a normal
 * Zod object; `inputObject`'s `.strict()` instead 422s, which is the
 * correct signal that the client is doing something it should not.
 */
export const BookingInquiryCreateInput = inputObject({
  name: z.string().min(1).max(160),
  email: z.string().email(),
  phone: z.string().max(30).nullish(),
  preferredChannel: z.string().max(20).optional(),
  eventType: EventKindSchema.optional(),
  eventDate: z.coerce.date().nullish(),
  eventEndDate: z.coerce.date().nullish(),
  isDateFlexible: z.boolean().optional(),
  venueText: z.string().max(300).nullish(),
  city: z.string().max(120).nullish(),
  country: z.string().max(120).optional(),
  guestCount: z.number().int().min(1).max(1_000_000).nullish(),
  durationHours: z.number().int().min(1).max(72).nullish(),
  budgetMin: z.number().min(0).max(100_000_000).nullish(),
  budgetMax: z.number().min(0).max(100_000_000).nullish(),
  currency: CurrencySchema.optional(),
  personaKey: PersonaKeySchema.nullish(),
  serviceSlug: Slug.nullish(),
  message: z.string().max(5000).nullish(),
  // Anti-abuse honeypot: hidden by CSS, so a real visitor never fills it in.
  // Accepted rather than rejected when non-empty — a browser autofill
  // plugin can populate a hidden field, and 422ing a real enquiry over that
  // is worse than quietly routing it to the spam queue instead.
  website: z.string().max(200).optional(),
  turnstileToken: z.string().min(1),
  utmSource: z.string().max(120).nullish(),
  utmMedium: z.string().max(120).nullish(),
  utmCampaign: z.string().max(120).nullish(),
  referrerUrl: z.string().max(500).nullish(),
  landingPath: z.string().max(500).nullish(),
}).refine((v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax, {
  message: 'The minimum budget must not exceed the maximum.',
  path: ['budgetMin'],
});
export type BookingInquiryCreateInput = z.infer<typeof BookingInquiryCreateInput>;

export const BookingInquiryPublicResult = z.object({
  reference: z.string(),
  whatsappUrl: z.string().nullable(),
});
export type BookingInquiryPublicResult = z.infer<typeof BookingInquiryPublicResult>;

export const InquiryNoteDetail = z.object({
  id: Id,
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  body: z.string(),
  createdAt: z.coerce.date(),
});
export type InquiryNoteDetail = z.infer<typeof InquiryNoteDetail>;

export const BookingInquiryAdminDetail = z.object({
  id: Id,
  reference: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  preferredChannel: z.string().nullable(),
  eventType: EventKindSchema,
  eventDate: z.coerce.date().nullable(),
  eventEndDate: z.coerce.date().nullable(),
  isDateFlexible: z.boolean(),
  venueText: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  guestCount: z.number().int().nullable(),
  durationHours: z.number().int().nullable(),
  budgetMin: z.number().nullable(),
  budgetMax: z.number().nullable(),
  currency: CurrencySchema,
  personaSlug: Slug.nullable(),
  serviceSlug: z.string().nullable(),
  message: z.string().nullable(),
  status: InquiryStatusSchema,
  source: InquirySourceSchema,
  assignedToId: z.string().nullable(),
  quotedAmount: z.number().nullable(),
  lostReason: z.string().nullable(),
  spamScore: z.number().int(),
  notifiedAt: z.coerce.date().nullable(),
  autoRespondedAt: z.coerce.date().nullable(),
  mailFailureCount: z.number().int(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  referrerUrl: z.string().nullable(),
  landingPath: z.string().nullable(),
  notes: z.array(InquiryNoteDetail),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BookingInquiryAdminDetail = z.infer<typeof BookingInquiryAdminDetail>;

export const InquiryUpdateInput = inputObject({
  status: InquiryStatusSchema.optional(),
  assignedToId: Id.nullish(),
  quotedAmount: z.number().min(0).max(100_000_000).nullish(),
  lostReason: z.string().max(300).nullish(),
  budgetMin: z.number().min(0).max(100_000_000).nullish(),
  budgetMax: z.number().min(0).max(100_000_000).nullish(),
  eventDate: z.coerce.date().nullish(),
});
export type InquiryUpdateInput = z.infer<typeof InquiryUpdateInput>;

export const InquiryNoteCreateInput = inputObject({
  body: z.string().min(1).max(5000),
});
export type InquiryNoteCreateInput = z.infer<typeof InquiryNoteCreateInput>;

export const InquiryAdminQuery = PaginationSchema.and(
  z.object({
    status: InquiryStatusSchema.optional(),
    q: z.string().max(120).optional(),
    assignedToId: Id.optional(),
    sort: sortSchema(['createdAt', 'eventDate', 'status']).default('-createdAt'),
  }),
);
export type InquiryAdminQuery = z.infer<typeof InquiryAdminQuery>;

// ─────────────────────────────────────────────────────────────────────────────
//  Newsletter
// ─────────────────────────────────────────────────────────────────────────────

export const SubscriberStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'UNSUBSCRIBED',
  'BOUNCED',
  'COMPLAINED',
]);
export type SubscriberStatus = z.infer<typeof SubscriberStatusSchema>;

export const NewsletterSubscribeInput = inputObject({
  email: z.string().email(),
  name: z.string().max(160).nullish(),
  source: z.string().max(60).nullish(),
  turnstileToken: z.string().min(1),
});
export type NewsletterSubscribeInput = z.infer<typeof NewsletterSubscribeInput>;

export const NewsletterConfirmInput = inputObject({
  token: z.string().min(1),
});
export type NewsletterConfirmInput = z.infer<typeof NewsletterConfirmInput>;

export const NewsletterUnsubscribeInput = inputObject({
  token: z.string().min(1),
});
export type NewsletterUnsubscribeInput = z.infer<typeof NewsletterUnsubscribeInput>;

export const NewsletterSubscriberAdminDetail = z.object({
  id: Id,
  email: z.string(),
  name: z.string().nullable(),
  status: SubscriberStatusSchema,
  confirmedAt: z.coerce.date().nullable(),
  unsubscribedAt: z.coerce.date().nullable(),
  source: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
});
export type NewsletterSubscriberAdminDetail = z.infer<typeof NewsletterSubscriberAdminDetail>;

export const NewsletterAdminQuery = PaginationSchema.and(
  z.object({
    status: SubscriberStatusSchema.optional(),
    q: z.string().max(120).optional(),
    sort: sortSchema(['createdAt', 'email']).default('-createdAt'),
  }),
);
export type NewsletterAdminQuery = z.infer<typeof NewsletterAdminQuery>;
