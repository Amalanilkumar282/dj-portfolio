import type { Metadata } from 'next';

import { VenueForm } from '../../../../components/venues/venue-form';

export const metadata: Metadata = { title: 'Edit venue' };

interface Params {
  id: string;
}

export default async function EditVenuePage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <VenueForm id={id} />;
}
