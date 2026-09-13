import type { FaqAdminDetail, FaqDetail } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

interface FaqRow {
  id: string;
  slug: string;
  question: string;
  answer: string;
  category: string | null;
  persona?: { slug: string } | null;
  service?: { slug: string } | null;
}

interface FaqAdminRow extends FaqRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toFaqDetail(row: FaqRow): FaqDetail {
  return {
    id: row.id,
    slug: row.slug,
    question: row.question,
    answer: row.answer,
    category: row.category,
    personaSlug: row.persona?.slug ?? null,
    serviceSlug: row.service?.slug ?? null,
  };
}

export function toFaqAdminDetail(row: FaqAdminRow): FaqAdminDetail {
  return {
    ...toFaqDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
