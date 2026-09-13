import type { Metadata } from 'next';

import { ProgramForm } from '../../../../components/programs/program-form';

export const metadata: Metadata = { title: 'Edit program' };

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <ProgramForm id={id} />;
}
