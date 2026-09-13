import type { Metadata } from 'next';

import { TrackForm } from '../../../../components/tracks/track-form';

export const metadata: Metadata = { title: 'Edit track' };

export default async function EditTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <TrackForm id={id} />;
}
