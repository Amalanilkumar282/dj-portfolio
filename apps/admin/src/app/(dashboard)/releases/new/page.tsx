import type { Metadata } from 'next';

import { ReleaseForm } from '../../../../components/releases/release-form';

export const metadata: Metadata = { title: 'New release' };

export default function NewReleasePage(): React.JSX.Element {
  return <ReleaseForm />;
}
