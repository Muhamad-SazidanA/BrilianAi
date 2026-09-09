'use client';

import React from 'react';
import { Cpu, Database, CheckCircle2, ShieldCheck, Layers, Zap } from 'lucide-react';
import { DashboardStats } from '@/types/stats';
import { useLanguage } from '@/context/LanguageContext';

interface SystemHealthProps {
  stats: DashboardStats | null;
}

export default function SystemHealth({ stats }: SystemHealthProps) {
  const { language, t } = useLanguage();
  const health = stats?.systemHealth;

  const pipelines = [
    {
      name: 'MuPDF WASM',
      role: 'In-Memory Renderer',
      status: 'Active',
      color: 'var(--color-primary)',
    },
    {
      name: health?.visionModel || 'qwen2.5vl:3b',
      role: language === 'en' ? 'Vision OCR (per page)' : 'Vision OCR (per halaman)',
      status: health?.ollama ? 'Online' : 'Standby',
      color: health?.ollama ? 'var(--color-success)' : 'var(--color-warning)',
    },
    {
      name: 'Sliding Window',
      role: 'Chunking 800c / 150 overlap',
      status: 'Active',
      color: 'var(--color-primary)',
    },
    {
      name: health?.embeddingModel || 'bge-m3',
      role: 'Dense Vector 1024-dim',
      status: health?.ollama ? 'Online' : 'Standby',
      color: health?.ollama ? 'var(--color-success)' : 'var(--color-warning)',
    },
  ];

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="var(--color-primary)" />
          <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('dash.pipeline_title')}
          </h3>
        </div>
        <span className="badge badge-accent" style={{ fontSize: '10.5px' }}>
          On-Premise
        </span>
      </div>

      {/* Database connection banner */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-subtle)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--color-primary-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
            }}
          >
            <Database size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              PostgreSQL + pgvector
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              HNSW vector index (1024-dim)
            </div>
          </div>
        </div>
        <span className="badge badge-success" style={{ fontSize: '11px' }}>
          <CheckCircle2 size={11} />
          Connected
        </span>
      </div>

      {/* Pipeline component rows */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          {language === 'en' ? 'AI Inference Components' : 'Komponen Inferensi AI'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pipelines.map((item, idx) => (
            <div
              key={item.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-card)',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {idx + 1}
                </span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', lineHeight: '15px' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.role}</div>
                </div>
              </div>

              <span
                className={`badge ${item.status === 'Online' || item.status === 'Active' ? 'badge-success' : 'badge-warning'}`}
                style={{ fontSize: '10.5px' }}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Safety footprint */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-primary-subtle)',
          border: '1px solid var(--color-primary-border)',
          fontSize: '12px',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 500,
        }}
      >
        <Zap size={15} style={{ flexShrink: 0 }} />
        <span>{t('dash.safety_buffer')}</span>
      </div>
    </div>
  );
}
