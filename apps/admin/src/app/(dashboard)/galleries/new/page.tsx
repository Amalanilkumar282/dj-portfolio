import type { Metadata } from 'next';

import { GalleryForm } from '../../../../components/galleries/gallery-form';

export const metadata: Metadata = { title: 'New gallery' };

export default function NewGalleryPage(): React.JSX.Element {
  return <GalleryForm />;
}
