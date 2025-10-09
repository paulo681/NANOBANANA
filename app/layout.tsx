import type { Metadata } from 'next';
import './globals.css';

import { AppHeader } from '@/components/AppHeader';
import { AppProviders } from '@/components/AppProviders';

export const metadata: Metadata = {
  title: 'NanoBanana Studio',
  description: 'Editeur d\'images enrichi par l\'IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-background text-slate-100">
        <AppProviders>
          <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-10 sm:px-8">
            <AppHeader />
            {children}
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
