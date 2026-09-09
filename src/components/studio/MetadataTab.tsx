'use client';

import React from 'react';
import { FileText, Cpu, Database, Calendar, Layers, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { UploadBatch, DocumentChunk } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface MetadataTabProps {
  batch: UploadBatch | null;
  chunks: DocumentChunk[];
}

export default function MetadataTab({ batch, chunks }: MetadataTabProps) {
  const { language, t } = useLanguage();
  if (!batch) return null;

  const totalChars = chunks.reduce((acc, c) => acc + (c.content?.length || 0), 0);
  const avgChars = chunks.length > 0 ? Math.round(totalChars / chunks.length) : 0;
  const chunkPerRatio = batch.page_count > 0 ? (chunks.length / batch.page_count).toFixed(1) : '0';

  const locale = language === 'en' ? 'en-US' : 'id-ID';
  const formattedDate = new Date(batch.uploaded_at).toLocaleString(locale, {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const metadataItems = [
    { label: t('meta.batch_id'), value: batch.id, mono: true },
    { label: t('meta.filename'), value: batch.original_filename },
    { label: t('meta.completed'), value: formattedDate },
    { label: t('meta.pages'), value: `${batch.page_count} ${t('studio.pages')}` },
    { label: t('meta.chunks'), value: `${batch.chunk_count} ${t('studio.chunks')}` },
    {
      label: t('meta.ratio'),
      value: language === 'en' ? `~${chunkPerRatio} chunks / page` : `~${chunkPerRatio} chunk / halaman`,
    },
    {
      label: t('meta.avg_len'),
      value:
        language === 'en'
          ? `${avgChars} characters (Sliding Window Target: 800)`
          : `${avgChars} karakter (Sliding Window Target: 800)`,
    },
    { label: t('meta.vision'), value: 'Qwen 2.5 VL (In-memory page scan)' },
    {
      label: t('meta.embedding'),
      value: language === 'en' ? 'BGE-M3 · 1024 Dimensions (Dense Vector)' : 'BGE-M3 · 1024 Dimensi (Dense Vector)',
    },
    { label: t('meta.vector_db'), value: 'pgvector (HNSW Index cosine similarity)' },
  ];

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('meta.title')}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {t('meta.subtitle')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {metadataItems.map((item) => (
          <div
            key={item.label}
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              {item.label}
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: item.mono ? 'var(--font-mono)' : 'inherit',
                wordBreak: 'break-all',
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

