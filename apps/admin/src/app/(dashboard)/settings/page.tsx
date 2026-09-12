import type { Metadata } from 'next';

import { SettingsForm } from '../../../components/settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage(): React.JSX.Element {
  return <SettingsForm />;
}
