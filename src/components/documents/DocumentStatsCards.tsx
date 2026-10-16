'use client';

import React from 'react';
import DashboardMetricCard from '@/components/dashboard/DashboardMetricCard';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface DocumentStatsCardsProps {
  batches: UploadBatch[];
  isLoading?: boolean;
  containerRef?: React.Ref<HTMLDivElement>;
}

export default function DocumentStatsCards({
  batches,
  isLoading = false,
  containerRef,
}: DocumentStatsCardsProps) {
  const { language } = useLanguage();

  const totalDocuments = batches.length;
  const totalPages = batches.reduce((acc, b) => acc + (b.page_count || 0), 0);
  const totalChunks = batches.reduce((acc, b) => acc + (b.chunk_count || 0), 0);
  const activeCount = batches.filter((b) => b.is_active_knowledge !== false).length;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'sticky',
        top: 'var(--header-height, 48px)',
        zIndex: 30,
        backgroundColor: 'var(--bg-app)',
        paddingTop: '6px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-default)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '0.85rem',
        }}
      >
      <DashboardMetricCard
        title={language === 'en' ? 'Total Documents' : 'Total Dokumen'}
        value={`${totalDocuments} Dokumen`}
        badge="Batches"
        badgeType="neutral"
        footerText={language === 'en' ? 'Verified PDF archive' : 'Arsip PDF terverifikasi'}
        isLoading={isLoading}
      />

      <DashboardMetricCard
        title={language === 'en' ? 'Vision OCR Pages' : 'Halaman AI Vision OCR'}
        value={`${totalPages} Halaman`}
        badge="Vision OCR"
        badgeType="neutral"
        statusDot="live"
        footerText={language === 'en' ? 'Precision text extraction' : 'Ekstraksi teks presisi'}
        isLoading={isLoading}
      />

      <DashboardMetricCard
        title={language === 'en' ? 'Knowledge Vectors' : 'Vektor Pengetahuan'}
        value={`${totalChunks} Chunks`}
        badge="1024-dim"
        badgeType="neutral"
        footerText={language === 'en' ? 'Sliding window 800c' : 'Sliding window 800c'}
        isLoading={isLoading}
      />

      <DashboardMetricCard
        title={language === 'en' ? 'Active Knowledge Base' : 'Basis Pengetahuan Aktif'}
        value={`${activeCount} Aktif`}
        badge="100% Siap"
        badgeType="neutral"
        statusDot="live"
        footerText={language === 'en' ? 'RAG organizational reference' : 'Rujukan RAG organisasi'}
        isLoading={isLoading}
      />
    </div>
  </div>
  );
}
