import type { BookingInquiryAdminDetail, InquiryNoteDetail } from '@dj/contracts';

/** A Prisma Decimal, or a plain number once it has been serialised. */
type DecimalLike = { toNumber: () => number } | number | null;

function toNumber(value: DecimalLike | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

interface NoteRow {
  id: string;
  authorId: string | null;
  author?: { name: string } | null;
  body: string;
  createdAt: Date;
}

interface InquiryRow {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  preferredChannel: string | null;
  eventType: string;
  eventDate: Date | null;
  eventEndDate: Date | null;
  isDateFlexible: boolean;
  venueText: string | null;
  city: string | null;
  country: string | null;
  guestCount: number | null;
  durationHours: number | null;
  budgetMin: DecimalLike;
  budgetMax: DecimalLike;
  currency: string;
  persona?: { slug: string } | null;
  serviceSlug: string | null;
  message: string | null;
  status: string;
  source: string;
  assignedToId: string | null;
  quotedAmount: DecimalLike;
  lostReason: string | null;
  spamScore: number;
  notifiedAt: Date | null;
  autoRespondedAt: Date | null;
  mailFailureCount: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerUrl: string | null;
  landingPath: string | null;
  notes?: NoteRow[];
  createdAt: Date;
  updatedAt: Date;
}

function toNoteDetail(row: NoteRow): InquiryNoteDetail {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.author?.name ?? null,
    body: row.body,
    createdAt: row.createdAt,
  };
}

export function toInquiryAdminDetail(row: InquiryRow): BookingInquiryAdminDetail {
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    email: row.email,
    phone: row.phone,
    preferredChannel: row.preferredChannel,
    eventType: row.eventType as BookingInquiryAdminDetail['eventType'],
    eventDate: row.eventDate,
    eventEndDate: row.eventEndDate,
    isDateFlexible: row.isDateFlexible,
    venueText: row.venueText,
    city: row.city,
    country: row.country,
    guestCount: row.guestCount,
    durationHours: row.durationHours,
    budgetMin: toNumber(row.budgetMin),
    budgetMax: toNumber(row.budgetMax),
    currency: row.currency as BookingInquiryAdminDetail['currency'],
    personaSlug: row.persona?.slug ?? null,
    serviceSlug: row.serviceSlug,
    message: row.message,
    status: row.status as BookingInquiryAdminDetail['status'],
    source: row.source as BookingInquiryAdminDetail['source'],
    assignedToId: row.assignedToId,
    quotedAmount: toNumber(row.quotedAmount),
    lostReason: row.lostReason,
    spamScore: row.spamScore,
    notifiedAt: row.notifiedAt,
    autoRespondedAt: row.autoRespondedAt,
    mailFailureCount: row.mailFailureCount,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    referrerUrl: row.referrerUrl,
    landingPath: row.landingPath,
    notes: (row.notes ?? []).map(toNoteDetail),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
