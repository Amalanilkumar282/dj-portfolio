import type { Metadata } from 'next';

import { EntityForm } from '../../../../components/generic/entity-form';
import { getEntityConfig } from '../../../../lib/entity-config';

export const metadata: Metadata = { title: 'New testimonial' };

export default function NewTestimonialPage(): React.JSX.Element {
  return <EntityForm config={getEntityConfig('testimonials')} />;
}
