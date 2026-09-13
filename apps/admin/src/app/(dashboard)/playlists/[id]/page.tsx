import type { Metadata } from 'next';

import { PlaylistForm } from '../../../../components/playlists/playlist-form';

export const metadata: Metadata = { title: 'Edit playlist' };

export default async function EditPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PlaylistForm id={id} />;
}
