import type { Metadata } from 'next';

import { VenueForm } from '../../../../components/venues/venue-form';

export const metadata: Metadata = { title: 'New venue' };

export default function NewVenuePage(): React.JSX.Element {
  return <VenueForm />;
}
