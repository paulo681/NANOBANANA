import type { Metadata } from 'next';
import './globals.css';

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
        <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-10 sm:px-8">
          {children}
        </div>
      </body>
    </html>
  );
}
