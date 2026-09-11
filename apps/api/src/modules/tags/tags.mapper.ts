import type { TagAdminDetail, TagDetail } from '@dj/contracts';

interface TagRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface TagAdminRow extends TagRow {
  createdAt: Date;
  updatedAt: Date;
  _count?: { posts: number };
}

export function toTagDetail(row: TagRow): TagDetail {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description };
}

export function toTagAdminDetail(row: TagAdminRow): TagAdminDetail {
  return {
    ...toTagDetail(row),
    postCount: row._count?.posts ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
