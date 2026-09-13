import type { Metadata } from 'next';

import { EntityForm } from '../../../../components/generic/entity-form';
import { getEntityConfig } from '../../../../lib/entity-config';

export const metadata: Metadata = { title: 'Edit stat' };

export default async function EditStatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <EntityForm config={getEntityConfig('stats')} id={id} />;
}
