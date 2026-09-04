import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrilianAI — Platform Analisis Dokumen',
  description:
    'Sistem ingestion dokumen PDF berbasis AI Vision dengan RAG, pgvector, dan chatbot lokal yang menjaga privasi data Anda.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        style={{
          fontFamily: 'var(--font-sans)',
          backgroundColor: 'var(--color-paper)',
          color: 'var(--color-ink)',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        {children}
      </body>
    </html>
  );
}
