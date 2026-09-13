import type { Metadata } from 'next';

import { AuditLog } from '../../../components/audit-log';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditLogPage(): React.JSX.Element {
  return <AuditLog />;
}
