import type { Metadata } from 'next';

import { VenuesList } from '../../../components/venues/venues-list';

export const metadata: Metadata = { title: 'Venues' };

export default function VenuesPage(): React.JSX.Element {
  return <VenuesList />;
}
