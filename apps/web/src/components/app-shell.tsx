'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { humanize } from '@/lib/format';
import type { Role } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: icon('M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10') },
  { href: '/patients', label: 'Patients', icon: icon('M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75') },
  { href: '/calendar', label: 'Calendar', icon: icon('M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z') },
  { href: '/sessions', label: 'Sessions', icon: icon('M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'), roles: ['ADMIN', 'DOCTOR', 'THERAPIST'] },
  { href: '/exercises', label: 'Exercises', icon: icon('M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M2 11v2M22 11v2'), roles: ['ADMIN', 'DOCTOR', 'THERAPIST'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={clsx(
              'flex min-h-touch items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
              active ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-600 text-lg font-bold text-white">K</span>
      <span className="text-lg font-semibold text-slate-900">KidRehab</span>
    </Link>
  );

  const userBox = user && (
    <div className="border-t border-slate-100 pt-4">
      <p className="truncate px-2 text-sm font-medium text-slate-900">{user.fullName}</p>
      <p className="truncate px-2 text-xs text-slate-500">
        {humanize(user.role)} · {user.clinic?.name}
      </p>
      <button onClick={logout} className="mt-2 flex min-h-touch w-full items-center rounded-xl px-2 text-sm text-slate-600 hover:bg-slate-100">
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop / landscape-tablet sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 lg:flex">
        <div className="space-y-6">
          {brand}
          {nav}
        </div>
        {userBox}
      </aside>

      {/* Portrait-tablet / mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        {brand}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="min-h-touch min-w-touch rounded-xl text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          {icon(menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16')}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 top-[61px] z-30 border-b border-slate-200 bg-white p-4 shadow-lg lg:hidden">
          {nav}
          <div className="mt-4">{userBox}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
