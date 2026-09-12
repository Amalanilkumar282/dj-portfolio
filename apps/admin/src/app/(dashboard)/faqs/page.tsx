import type { Metadata } from 'next';

import { EntityList } from '../../../components/generic/entity-list';
import { getEntityConfig } from '../../../lib/entity-config';

export const metadata: Metadata = { title: 'FAQs' };

export default function FaqsPage(): React.JSX.Element {
  return <EntityList config={getEntityConfig('faqs')} />;
}
