import type { Metadata } from 'next';

import { EntityForm } from '../../../../components/generic/entity-form';
import { getEntityConfig } from '../../../../lib/entity-config';

export const metadata: Metadata = { title: 'New redirect' };

export default function NewRedirectPage(): React.JSX.Element {
  return <EntityForm config={getEntityConfig('redirects')} />;
}
