import type { Metadata } from 'next';

import { PersonaForm } from '../../../../components/personas/persona-form';

export const metadata: Metadata = { title: 'New persona' };

export default function NewPersonaPage(): React.JSX.Element {
  return <PersonaForm />;
}
