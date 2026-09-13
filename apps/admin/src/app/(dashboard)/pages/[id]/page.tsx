import type { Metadata } from 'next';

import { StaticPageForm } from '../../../../components/static-page-form';

export const metadata: Metadata = { title: 'Edit page' };

export default async function EditStaticPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <StaticPageForm id={id} />;
}
