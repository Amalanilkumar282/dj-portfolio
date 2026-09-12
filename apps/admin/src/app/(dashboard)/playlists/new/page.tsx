import type { Metadata } from 'next';

import { PlaylistForm } from '../../../../components/playlists/playlist-form';

export const metadata: Metadata = { title: 'New playlist' };

export default function NewPlaylistPage(): React.JSX.Element {
  return <PlaylistForm />;
}
