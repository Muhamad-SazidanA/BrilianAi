import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrilianAI - PDF Ingestion AI Vision',
  description: 'Sistem Ingestion PDF via AI Vision menggunakan Next.js dan LangChain',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
