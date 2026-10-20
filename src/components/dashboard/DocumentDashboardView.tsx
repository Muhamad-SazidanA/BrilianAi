'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  UploadCloud,
  ChevronRight,
} from 'lucide-react';
import DashboardMetricCard from './DashboardMetricCard';
import { DashboardStats } from '@/types/stats';
import { formatDateTime } from '@lib/utils/formatters';
import { useLanguage } from '@/context/LanguageContext';

interface DocumentDashboardViewProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  syncTime: string;
}

export default function DocumentDashboardView({
  stats,
  isLoading,
  onRefresh,
  syncTime,
}: DocumentDashboardViewProps) {
  const { language } = useLanguage();
  const batches = stats?.recentBatches || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── 1. Top Row: 4 Metric Cards (Generous min-width, no text wrapping) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <DashboardMetricCard
          title="Total Dokumen Diunggah"
          value={`${stats?.totalDocuments ?? 0} Dokumen`}
          badge="Batches"
          badgeType="neutral"
          footerText="Arsip PDF terverifikasi"
          href="/documents"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Halaman AI Vision OCR"
          value={`${stats?.totalPages ?? 0} Halaman`}
          badge="Vision OCR"
          badgeType="success"
          statusDot="live"
          footerText="Ekstraksi teks presisi"
          href="/documents"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Vektor Pengetahuan"
          value={`${stats?.totalChunks ?? 0} Chunks`}
          badge="1024-dim"
          badgeType="accent"
          footerText="Sliding window 800c"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Basis Pengetahuan Aktif"
          value={`${stats?.activeKnowledgeCount ?? 0} Aktif`}
          badge="Terkurasi"
          badgeType="success"
          statusDot="live"
          footerText="Rujukan Asisten AI"
          href="/documents"
          isLoading={isLoading}
        />
      </div>

      {/* ── 2. Batches Table Stream ── */}
      <div className="enterprise-card">
        {/* Table header */}
        <div className="enterprise-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Batch Dokumen Terbaru
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              · {batches.length} batch
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              href="/upload"
              className="btn btn-primary btn-xs"
              style={{
                fontSize: '11.5px',
                padding: '3px 10px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <UploadCloud size={12} />
              <span>Upload PDF</span>
            </Link>

            <Link
              href="/documents"
              style={{
                fontSize: '11.5px',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>Repositori</span>
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* Rows with Skeleton Shimmer (No Layout Shift) */}
        {isLoading ? (
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <span className="skeleton-shimmer" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
                  <span className="skeleton-shimmer" style={{ width: '40%', height: '14px' }} />
                  <span className="skeleton-shimmer" style={{ width: '25%', height: '11px' }} />
                </div>
                <span className="skeleton-shimmer" style={{ width: '60px', height: '20px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Belum ada file diunggah. Silakan klik &quot;Upload PDF&quot; untuk memulai pemindaian AI Vision OCR.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {batches.slice(0, 5).map((batch, idx) => {
              const formattedDate = formatDateTime(batch.uploaded_at, language);

              return (
                <div
                  key={batch.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: idx === Math.min(batches.length, 5) - 1 ? 'none' : '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '12px',
                  }}
                  className="hover-bg-subtle"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-primary-subtle, rgba(37, 99, 235, 0.08))',
                        color: 'var(--color-primary, #2563EB)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={14} />
                    </div>

                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '260px',
                      }}
                    >
                      {batch.original_filename}
                    </span>

                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      · {batch.page_count} Hal (OCR) · {batch.chunk_count} Chunks
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {batch.is_active_knowledge ? (
                      <span className="badge badge-success" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                        Aktif
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                        Belum Aktif
                      </span>
                    )}

                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formattedDate}
                    </span>

                    <Link
                      href={`/documents/${batch.id}`}
                      className="btn btn-outline btn-xs"
                      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px' }}
                    >
                      Studio
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
