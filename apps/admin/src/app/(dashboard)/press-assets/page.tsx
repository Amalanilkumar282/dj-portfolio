import type { Metadata } from 'next';

import { EntityList } from '../../../components/generic/entity-list';
import { getEntityConfig } from '../../../lib/entity-config';

export const metadata: Metadata = { title: 'Press assets' };

export default function PressAssetsPage(): React.JSX.Element {
  return <EntityList config={getEntityConfig('press-kit')} />;
}
