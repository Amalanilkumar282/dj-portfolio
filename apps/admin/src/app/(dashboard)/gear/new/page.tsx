import type { Metadata } from 'next';

import { EntityForm } from '../../../../components/generic/entity-form';
import { getEntityConfig } from '../../../../lib/entity-config';

export const metadata: Metadata = { title: 'New gear item' };

export default function NewGearPage(): React.JSX.Element {
  return <EntityForm config={getEntityConfig('gear')} />;
}
