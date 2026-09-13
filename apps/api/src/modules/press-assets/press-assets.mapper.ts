import type { PressAssetAdminDetail, PressAssetDetail } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface PressAssetRow {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  media: MediaAssetRow | null;
  persona: { slug: string } | null;
  version: number;
  requiresEmail: boolean;
}

interface PressAssetAdminRow extends PressAssetRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
  downloadCount: number;
}

export function toPressAssetDetail(row: PressAssetRow): PressAssetDetail {
  return {
    id: row.id,
    kind: row.kind as PressAssetDetail['kind'],
    title: row.title,
    description: row.description,
    media: toMediaImage(row.media),
    // Never populated on a general read: a download URL is only meaningful
    // — and only signed with an expiry — from `POST /press-kit/:id/download`.
    downloadUrl: null,
    personaSlug: row.persona?.slug ?? null,
    version: row.version,
    requiresEmail: row.requiresEmail,
  };
}

export function toPressAssetAdminDetail(row: PressAssetAdminRow): PressAssetAdminDetail {
  return {
    ...toPressAssetDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    downloadCount: row.downloadCount,
  };
}
