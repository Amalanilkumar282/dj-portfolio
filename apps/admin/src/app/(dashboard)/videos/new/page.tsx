import type { Metadata } from 'next';

import { VideoForm } from '../../../../components/videos/video-form';

export const metadata: Metadata = { title: 'New video' };

export default function NewVideoPage(): React.JSX.Element {
  return <VideoForm />;
}
