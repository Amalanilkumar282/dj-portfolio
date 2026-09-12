import type { Metadata } from 'next';

import { ReleaseForm } from '../../../../components/releases/release-form';

export const metadata: Metadata = { title: 'Edit release' };

export default async function EditReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ReleaseForm id={id} />;
}
