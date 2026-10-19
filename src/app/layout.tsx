import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { UserSessionProvider } from '@/context/UserSessionContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { IngestionProvider } from '@/context/IngestionContext';
import IngestionDock from '@/components/documents/IngestionDock';
import IngestionDetailModal from '@/components/documents/IngestionDetailModal';
import ToastProvider from '@/components/providers/ToastProvider';

const geistSans = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
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
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
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
      <body className={geistSans.className} suppressHydrationWarning>
        <LanguageProvider>
          <UserSessionProvider>
            <SidebarProvider>
              <IngestionProvider>
                {children}
                <IngestionDock />
                <IngestionDetailModal />
                <ToastProvider />
              </IngestionProvider>
            </SidebarProvider>
          </UserSessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

