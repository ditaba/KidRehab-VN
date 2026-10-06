import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'KidRehab', template: '%s · KidRehab' },
  description: 'Pediatric rehabilitation management – making progress measurable.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#3b76e0' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
