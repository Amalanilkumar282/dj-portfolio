import type { PostAdminDetail, PostDetail, PostSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, toSeoMeta, type MediaAssetRow, type SeoRow } from '../../common/base';

interface TagRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  readingMinutes: number | null;
  cover?: MediaAssetRow | null;
  persona?: { slug: string } | null;
  authorName: string | null;
  isFeatured: boolean;
  publishedAt: Date | null;
  tags?: { tag: TagRow }[];
  content?: unknown;
  seoMeta?: SeoRow | null;
}

interface PostAdminRow extends PostRow {
  content: unknown;
  status: ContentStatus;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPostSummary(row: PostRow): PostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    readingMinutes: row.readingMinutes,
    cover: toMediaImage(row.cover),
    personaSlug: row.persona?.slug ?? null,
    authorName: row.authorName,
    isFeatured: row.isFeatured,
    publishedAt: row.publishedAt,
    tags: (row.tags ?? []).map((t) => ({
      id: t.tag.id,
      slug: t.tag.slug,
      name: t.tag.name,
      description: t.tag.description,
    })),
  };
}

export function toPostDetail(row: PostRow): PostDetail {
  return {
    ...toPostSummary(row),
    content: row.content ?? null,
    seo: toSeoMeta(row.seoMeta ?? null),
  };
}

export function toPostAdminDetail(row: PostAdminRow): PostAdminDetail {
  return {
    ...toPostDetail(row),
    status: row.status,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
