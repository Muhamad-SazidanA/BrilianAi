import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import ToastProvider from '@/components/providers/ToastProvider';

export const metadata: Metadata = {
  title: 'Brilian.Ai — AI Ingestion & pgvector Knowledge Base',
  description: 'Sistem Ingestion PDF dan Basis Pengetahuan Enterprise Brilian.Ai dengan pgvector.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <LanguageProvider>
          {children}
          <ToastProvider />
        </LanguageProvider>
      </body>
    </html>
  );
}
