import type { GalleryAdminDetail, GalleryDetail, GallerySummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface GalleryItemRow {
  id: string;
  caption: string | null;
  isCover: boolean;
  media?: MediaAssetRow | null;
}

interface GalleryRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  layout: string;
  persona?: { slug: string; key: string } | null;
  items?: GalleryItemRow[];
}

interface GalleryAdminRow extends GalleryRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

function toGalleryItemSummary(row: GalleryItemRow) {
  return {
    id: row.id,
    image: toMediaImage(row.media),
    caption: row.caption,
    isCover: row.isCover,
  };
}

export function toGallerySummary(row: GalleryRow): GallerySummary {
  const items = row.items ?? [];
  const cover = items.find((item) => item.isCover) ?? items[0];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    personaSlug: row.persona?.slug ?? null,
    personaKey: (row.persona?.key as GallerySummary['personaKey']) ?? null,
    layout: row.layout as GallerySummary['layout'],
    cover: cover ? toMediaImage(cover.media) : null,
    itemCount: items.length,
  };
}

export function toGalleryDetail(row: GalleryRow): GalleryDetail {
  return {
    ...toGallerySummary(row),
    items: (row.items ?? []).map(toGalleryItemSummary),
  };
}

export function toGalleryAdminDetail(row: GalleryAdminRow): GalleryAdminDetail {
  return {
    ...toGalleryDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
