import type { Metadata } from 'next';

import { TrackForm } from '../../../../components/tracks/track-form';

export const metadata: Metadata = { title: 'New track' };

export default function NewTrackPage(): React.JSX.Element {
  return <TrackForm />;
}
