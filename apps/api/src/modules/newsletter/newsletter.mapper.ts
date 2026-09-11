import type { NewsletterSubscriberAdminDetail } from '@dj/contracts';

interface SubscriberRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  source: string | null;
  tags: string[];
  createdAt: Date;
}

export function toSubscriberAdminDetail(row: SubscriberRow): NewsletterSubscriberAdminDetail {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status as NewsletterSubscriberAdminDetail['status'],
    confirmedAt: row.confirmedAt,
    unsubscribedAt: row.unsubscribedAt,
    source: row.source,
    tags: row.tags,
    createdAt: row.createdAt,
  };
}
