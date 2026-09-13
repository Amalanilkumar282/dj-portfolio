import type { TestimonialAdminDetail, TestimonialDetail } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface TestimonialRow {
  id: string;
  authorName: string;
  authorRole: string | null;
  venueOrEvent: string | null;
  company: string | null;
  quote: string;
  rating: number | null;
  eventDate: Date | null;
  persona: { slug: string } | null;
  avatar: MediaAssetRow | null;
  sourceUrl: string | null;
  isFeatured: boolean;
  isVerified: boolean;
}

interface TestimonialAdminRow extends TestimonialRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toTestimonialDetail(row: TestimonialRow): TestimonialDetail {
  return {
    id: row.id,
    authorName: row.authorName,
    authorRole: row.authorRole,
    venueOrEvent: row.venueOrEvent,
    company: row.company,
    quote: row.quote,
    rating: row.rating,
    eventDate: row.eventDate,
    personaSlug: row.persona?.slug ?? null,
    avatar: toMediaImage(row.avatar),
    sourceUrl: row.sourceUrl,
    isFeatured: row.isFeatured,
    isVerified: row.isVerified,
  };
}

export function toTestimonialAdminDetail(row: TestimonialAdminRow): TestimonialAdminDetail {
  return {
    ...toTestimonialDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
