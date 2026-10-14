'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const t = useT();
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loading label={t('patients.loadingApp')} />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
