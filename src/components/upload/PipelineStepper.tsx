'use client';

import React from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PipelineStep } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface PipelineStepperProps {
  steps: PipelineStep[];
  currentStepMessage?: string;
  isProcessing: boolean;
  currentProgress?: {
    status?: string;
    totalChunks?: number;
    processedChunks?: number;
    progressPercent?: number;
    totalPages?: number;
    currentPage?: number;
  } | null;
}

export default function PipelineStepper({ steps, currentStepMessage, isProcessing, currentProgress }: PipelineStepperProps) {
  const { t } = useLanguage();

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('upload.pipeline_title')}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {t('upload.pipeline_subtitle')}
          </p>
        </div>

        {isProcessing && (
          <div
            className="badge badge-accent animate-pulse-subtle"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            <Loader2 size={13} className="animate-spin" />
            <span>{t('upload.processing')}</span>
          </div>
        )}
      </div>

      {/* Stepper Steps Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          position: 'relative',
          padding: '8px 0',
        }}
      >
        {/* Connector Line Behind Rings */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '12%',
            right: '12%',
            height: '2px',
            backgroundColor: 'var(--border-default)',
            zIndex: 0,
          }}
        />

        {steps.map((step) => {
          const isDone = step.status === 'done';
          const isRunning = step.status === 'running';
          const isError = step.status === 'error';

          return (
            <div
              key={step.number}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
                gap: '10px',
              }}
            >
              {/* Step indicator circle */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDone
                    ? 'var(--color-success)'
                    : isRunning
                    ? 'var(--color-primary)'
                    : isError
                    ? 'var(--color-danger)'
                    : 'var(--bg-card)',
                  color: isDone || isRunning || isError ? '#ffffff' : 'var(--text-secondary)',
                  border: isDone || isRunning || isError ? 'none' : '2px solid var(--border-default)',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  boxShadow: isRunning ? '0 0 0 4px var(--color-primary-ring)' : 'var(--shadow-xs)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isDone ? (
                  <CheckCircle2 size={18} />
                ) : isRunning ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isError ? (
                  <AlertCircle size={18} />
                ) : (
                  step.number
                )}
              </div>

                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isRunning ? 'var(--color-primary)' : 'var(--text-primary)',
                      lineHeight: '17px',
                    }}
                  >
                    {t(`upload.step${step.number}_title`) || step.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: '15px' }}>
                    {t(`upload.step${step.number}_desc`) || step.description}
                  </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* Live processing status banner */}
      {isProcessing && currentStepMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary-subtle)',
            border: '1px solid var(--color-primary-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Loader2 size={18} color="var(--color-primary)" className="animate-spin" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {t('upload.live_process')}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px', fontWeight: 500 }}>
              {currentStepMessage}
            </div>

            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  width: '100%',
                  height: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, currentProgress?.progressPercent ?? 0))}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #7aa8ff 0%, #6d8ef3 100%)',
                    borderRadius: '999px',
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span>
                  {currentProgress?.totalChunks !== undefined && currentProgress?.processedChunks !== undefined
                    ? `${currentProgress.processedChunks} / ${currentProgress.totalChunks} chunks diproses`
                    : currentProgress?.totalPages !== undefined && currentProgress?.currentPage !== undefined
                      ? `${currentProgress.currentPage} / ${currentProgress.totalPages} halaman`
                      : currentProgress?.progressPercent !== undefined
                        ? `${Math.round(currentProgress.progressPercent)}% selesai`
                        : 'Memproses...'}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                  {currentProgress?.progressPercent !== undefined ? `${Math.round(currentProgress.progressPercent)}%` : '0%' }
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
