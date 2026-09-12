import type { Metadata } from 'next';

import { InquiryKanban } from '../../../components/inquiries/inquiry-kanban';

export const metadata: Metadata = { title: 'Bookings' };

export default function InquiriesPage(): React.JSX.Element {
  return <InquiryKanban />;
}
