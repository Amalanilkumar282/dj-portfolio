import type { Metadata } from 'next';

import { EntityList } from '../../../components/generic/entity-list';
import { getEntityConfig } from '../../../lib/entity-config';

export const metadata: Metadata = { title: 'Tracks' };

export default function TracksPage(): React.JSX.Element {
  return <EntityList config={getEntityConfig('tracks')} />;
}
