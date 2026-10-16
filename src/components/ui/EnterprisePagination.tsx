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

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
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

  const pageNumbers = getPageNumbers(safePage, totalPages);
  const options = Array.from(new Set([pageSize, ...pageSizeOptions])).sort((a, b) => a - b);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderTop: '1px solid var(--border-default, #e2e8f0)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        fontSize: '12.5px',
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
      {/* ── Left: Halaman X / Y ── */}
      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)' }}>
        {language === 'en'
          ? `Page ${safePage} / ${totalPages}`
          : `Halaman ${safePage} / ${totalPages}`}
      </span>

      {/* ── Right: Baris per halaman + Dropdown + < Prev Page + Numbers + Next Page > ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Rows per page selector */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)' }}>
              {language === 'en' ? 'Rows per page' : 'Baris per halaman'}
            </span>
            <EnterpriseSelect
              value={pageSize}
              onChange={(val) => onPageSizeChange(Number(val))}
              options={options.map((opt) => ({
                value: opt,
                label: String(opt),
              }))}
              size="sm"
              buttonHeight="28px"
              buttonStyle={{ fontSize: '12.5px', padding: '0 8px', borderRadius: '6px' }}
              variant="rounded"
              direction="up"
              width="58px"
              menuWidth="72px"
              ariaLabel={language === 'en' ? 'Rows per page' : 'Baris per halaman'}
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Prev Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={!canPrev}
            style={{
              height: '28px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid transparent',
              backgroundColor: 'transparent',
              color: canPrev ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
              fontSize: '12.5px',
              cursor: canPrev ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              opacity: canPrev ? 1 : 0.45,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (canPrev) {
                e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
              }
            }}
            onMouseLeave={(e) => {
              if (canPrev) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <ChevronLeft size={13} />
            <span>Prev Page</span>
          </button>

          {/* Numbered Page Buttons */}
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '28px',
                    minWidth: '24px',
                    padding: '0 4px',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: '12px',
                    userSelect: 'none',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === safePage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                style={{
                  height: '28px',
                  minWidth: '28px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: isActive
                    ? '1px solid var(--border-default, #e2e8f0)'
                    : '1px solid transparent',
                  backgroundColor: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                  color: isActive ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
                  fontSize: '12.5px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s ease',
                  boxShadow: isActive ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                    e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
                  }
                }}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={!canNext}
            style={{
              height: '28px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid transparent',
              backgroundColor: 'transparent',
              color: canNext ? 'var(--text-primary, #0f172a)' : 'var(--text-muted, #94a3b8)',
              fontSize: '12.5px',
              cursor: canNext ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              opacity: canNext ? 1 : 0.45,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (canNext) {
                e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
              }
            }}
            onMouseLeave={(e) => {
              if (canNext) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <span>Next Page</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
