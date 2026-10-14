import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n/core';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'KidRehab', template: '%s · KidRehab' },
  description: 'Quản lý phục hồi chức năng nhi – đo lường được tiến triển. Pediatric rehabilitation management – making progress measurable.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3b76e0' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;
  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
