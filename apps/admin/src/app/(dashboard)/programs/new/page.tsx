import type { Metadata } from 'next';

import { ProgramForm } from '../../../../components/programs/program-form';

export const metadata: Metadata = { title: 'New program' };

export default function NewProgramPage(): React.JSX.Element {
  return <ProgramForm />;
}
