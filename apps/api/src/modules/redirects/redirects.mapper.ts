import type { RedirectAdminDetail, RedirectDetail } from '@dj/contracts';

interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  kind: string;
  isActive: boolean;
  hitCount: number;
  note: string | null;
}

interface RedirectAdminRow extends RedirectRow {
  createdAt: Date;
  updatedAt: Date;
}

export function toRedirectDetail(row: RedirectRow): RedirectDetail {
  return {
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    kind: row.kind as RedirectDetail['kind'],
    isActive: row.isActive,
    hitCount: row.hitCount,
    note: row.note,
  };
}

export function toRedirectAdminDetail(row: RedirectAdminRow): RedirectAdminDetail {
  return { ...toRedirectDetail(row), createdAt: row.createdAt, updatedAt: row.updatedAt };
}
