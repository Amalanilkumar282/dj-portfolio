import type { Metadata } from 'next';

import { EventForm } from '../../../../components/events/event-form';

export const metadata: Metadata = { title: 'New event' };

export default function NewEventPage(): React.JSX.Element {
  return <EventForm />;
}
