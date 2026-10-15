import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { UserSessionProvider } from '@/context/UserSessionContext';
import ToastProvider from '@/components/providers/ToastProvider';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Brilian.Ai — AI Ingestion & pgvector Knowledge Base',
  description: 'Sistem Ingestion PDF dan Basis Pengetahuan Enterprise Brilian.Ai dengan pgvector.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/images/BrilianLogo-Close-P.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className={plusJakarta.className} suppressHydrationWarning>
        <LanguageProvider>
          <UserSessionProvider>
            {children}
            <ToastProvider />
          </UserSessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

