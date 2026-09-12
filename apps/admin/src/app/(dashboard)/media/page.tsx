import type { Metadata } from 'next';

import { MediaLibrary } from '../../../components/media/media-library';

export const metadata: Metadata = { title: 'Media library' };

export default function MediaPage(): React.JSX.Element {
  return <MediaLibrary />;
}
