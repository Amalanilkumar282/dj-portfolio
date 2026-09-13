import type { StatAdminDetail, StatDetail } from '@dj/contracts';

interface StatRow {
  id: string;
  key: string;
  label: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  suffix: string | null;
  icon: string | null;
  persona?: { slug: string } | null;
  isVisible: boolean;
  sortIndex: number;
}

interface StatAdminRow extends StatRow {
  createdAt: Date;
  updatedAt: Date;
}

export function toStatDetail(row: StatRow): StatDetail {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    value: row.value,
    numericValue: row.numericValue,
    unit: row.unit,
    suffix: row.suffix,
    icon: row.icon,
    personaSlug: row.persona?.slug ?? null,
    isVisible: row.isVisible,
    sortIndex: row.sortIndex,
  };
}

export function toStatAdminDetail(row: StatAdminRow): StatAdminDetail {
  return { ...toStatDetail(row), createdAt: row.createdAt, updatedAt: row.updatedAt };
}
