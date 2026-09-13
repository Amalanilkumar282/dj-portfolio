import type { Metadata } from 'next';

import { PersonaForm } from '../../../../components/personas/persona-form';

export const metadata: Metadata = { title: 'Edit persona' };

export default async function EditPersonaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PersonaForm id={id} />;
}
