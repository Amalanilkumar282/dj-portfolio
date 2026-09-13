import { DashboardShell } from '../../components/dashboard-shell';

/**
 * Server Component wrapper — `dj/no-client-in-route-files` bans `'use
 * client'` directly in `layout.tsx`/`page.tsx`, so the actual interactive
 * shell lives in `<DashboardShell>`, a client leaf this just renders.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <DashboardShell>{children}</DashboardShell>;
}
