'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EnterpriseSelect from './EnterpriseSelect';

export interface EnterprisePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  language?: 'id' | 'en';
}

export default function EnterprisePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  language = 'id',
}: EnterprisePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderTop: '1px solid var(--border-default, #e2e8f0)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        fontSize: '11.5px',
        color: 'var(--text-secondary, #64748b)',
        marginTop: 'auto',
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        borderBottomLeftRadius: 'inherit',
        borderBottomRightRadius: 'inherit',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      {/* ── Left: Compact info ("Hal 1 dari 3 · 29 total") + Page Size Dropdown ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
          {language === 'en'
            ? `Page ${safePage} of ${totalPages}`
            : `Hal ${safePage} dari ${totalPages}`}
          <span style={{ opacity: 0.6, margin: '0 4px' }}>·</span>
          <span style={{ fontFeatureSettings: '"tnum"' }}>
            {totalItems} {language === 'en' ? 'total' : 'total'}
          </span>
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>|</span>
            <EnterpriseSelect
              value={pageSize}
              onChange={(val) => onPageSizeChange(Number(val))}
              options={pageSizeOptions.map((opt) => ({
                value: opt,
                label: `${opt} / ${language === 'en' ? 'page' : 'hal'}`,
              }))}
              size="xs"
              variant="pill"
              direction="up"
              width="auto"
              menuWidth="105px"
              ariaLabel="Item per halaman"
            />
          </div>
        )}
      </div>

      {/* ── Right: Compact Chevron Navigation (< >) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={!canPrev}
          title={language === 'en' ? 'Previous page' : 'Halaman sebelumnya'}
          aria-label={language === 'en' ? 'Previous page' : 'Halaman sebelumnya'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '5px',
            border: '1px solid var(--border-default, #e2e8f0)',
            backgroundColor: canPrev ? 'var(--bg-card, #ffffff)' : 'transparent',
            color: canPrev ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
            cursor: canPrev ? 'pointer' : 'not-allowed',
            opacity: canPrev ? 1 : 0.4,
            transition: 'all 0.12s ease',
            padding: 0,
          }}
        >
          <ChevronLeft size={13} />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={!canNext}
          title={language === 'en' ? 'Next page' : 'Halaman berikutnya'}
          aria-label={language === 'en' ? 'Next page' : 'Halaman berikutnya'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '5px',
            border: '1px solid var(--border-default, #e2e8f0)',
            backgroundColor: canNext ? 'var(--bg-card, #ffffff)' : 'transparent',
            color: canNext ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
            cursor: canNext ? 'pointer' : 'not-allowed',
            opacity: canNext ? 1 : 0.4,
            transition: 'all 0.12s ease',
            padding: 0,
          }}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
