import type { ExperienceEntryAdminDetail, ExperienceEntryDetail } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface ExperienceRow {
  id: string;
  role: string;
  organisation: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  summary: string | null;
  highlights: string[];
  logo: MediaAssetRow | null;
}

interface ExperienceAdminRow extends ExperienceRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toExperienceDetail(row: ExperienceRow): ExperienceEntryDetail {
  return {
    id: row.id,
    role: row.role,
    organisation: row.organisation,
    location: row.location,
    startDate: row.startDate,
    endDate: row.endDate,
    isCurrent: row.isCurrent,
    summary: row.summary,
    highlights: row.highlights,
    logo: toMediaImage(row.logo),
  };
}

export function toExperienceAdminDetail(row: ExperienceAdminRow): ExperienceEntryAdminDetail {
  return {
    ...toExperienceDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
