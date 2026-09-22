import type { Metadata } from 'next';

import { VideoForm } from '../../../../components/videos/video-form';

export const metadata: Metadata = { title: 'Edit video' };

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <VideoForm id={id} />;
}
