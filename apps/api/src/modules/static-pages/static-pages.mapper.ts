import type { StaticPageAdminDetail, StaticPageDetail } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toSeoMeta, type SeoRow } from '../../common/base';

interface StaticPageRow {
  id: string;
  slug: string;
  title: string;
  content: unknown;
  lastReviewedAt: Date | null;
  seoMeta: SeoRow | null;
}

interface StaticPageAdminRow extends StaticPageRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toStaticPageDetail(row: StaticPageRow): StaticPageDetail {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: row.content,
    lastReviewedAt: row.lastReviewedAt,
    seo: toSeoMeta(row.seoMeta),
  };
}

export function toStaticPageAdminDetail(row: StaticPageAdminRow): StaticPageAdminDetail {
  return {
    ...toStaticPageDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
