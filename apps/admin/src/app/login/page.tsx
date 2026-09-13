import type { Metadata } from 'next';

import { LoginForm } from '../../components/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage(): React.JSX.Element {
  return <LoginForm />;
}
