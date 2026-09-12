import type { Metadata } from 'next';

import { StaticPageForm } from '../../../../components/static-page-form';

export const metadata: Metadata = { title: 'New page' };

export default function NewStaticPage(): React.JSX.Element {
  return <StaticPageForm />;
}
