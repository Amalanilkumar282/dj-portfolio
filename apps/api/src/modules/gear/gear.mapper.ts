import type { GearItemAdminDetail, GearItemDetail } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface GearRow {
  id: string;
  slug: string;
  category: string;
  brand: string;
  model: string;
  proficiency: string;
  yearsUsed: number | null;
  notes: string | null;
  isRiderItem: boolean;
  isPreferred: boolean;
  image: MediaAssetRow | null;
}

interface GearAdminRow extends GearRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toGearDetail(row: GearRow): GearItemDetail {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category as GearItemDetail['category'],
    brand: row.brand,
    model: row.model,
    proficiency: row.proficiency as GearItemDetail['proficiency'],
    yearsUsed: row.yearsUsed,
    notes: row.notes,
    isRiderItem: row.isRiderItem,
    isPreferred: row.isPreferred,
    image: toMediaImage(row.image),
  };
}

export function toGearAdminDetail(row: GearAdminRow): GearItemAdminDetail {
  return {
    ...toGearDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
