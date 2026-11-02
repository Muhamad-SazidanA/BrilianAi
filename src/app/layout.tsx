import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { UserSessionProvider } from '@/context/UserSessionContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { IngestionProvider } from '@/context/IngestionContext';
import IngestionDock from '@/components/documents/IngestionDock';
import ToastProvider from '@/components/providers/ToastProvider';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Brilian.Ai — AI Ingestion & pgvector Knowledge Base',
  description: 'Sistem Ingestion PDF dan Basis Pengetahuan Enterprise Brilian.Ai dengan pgvector.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '256x256' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="256x256" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (localStorage.getItem('sidebar_collapsed') === 'true') {
                    document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${plexSans.className} antialiased`} suppressHydrationWarning>
        <LanguageProvider>
          <UserSessionProvider>
            <SidebarProvider>
              <IngestionProvider>
                {children}
                <IngestionDock />
                <ToastProvider />
              </IngestionProvider>
            </SidebarProvider>
          </UserSessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

