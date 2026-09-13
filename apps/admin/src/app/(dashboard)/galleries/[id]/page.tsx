import type { Metadata } from 'next';

import { GalleryForm } from '../../../../components/galleries/gallery-form';

export const metadata: Metadata = { title: 'Edit gallery' };

export default async function EditGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <GalleryForm id={id} />;
}
