import type { Metadata } from 'next';

import { EventForm } from '../../../../components/events/event-form';

export const metadata: Metadata = { title: 'Edit event' };

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <EventForm id={id} />;
}
