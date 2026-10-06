'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loading label="Loading KidRehab…" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
