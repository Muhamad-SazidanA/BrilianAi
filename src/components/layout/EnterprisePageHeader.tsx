'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Filter, ChevronDown } from 'lucide-react';

export interface EnterpriseTab {
  key: string;
  label: string;
  count?: number;
}

export interface EnterpriseTimeFilterOption {
  key: string;
  label: string;
}

export interface EnterprisePageHeaderProps {
  title: string;
  subtitle?: string;
  syncTime?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  timeOptions?: EnterpriseTimeFilterOption[];
  tabs?: EnterpriseTab[];
  activeTab?: string;
  onTabChange?: (tabKey: string) => void;
  actions?: React.ReactNode;
}

export default function EnterprisePageHeader({
  title,
  subtitle,
  syncTime,
  onRefresh,
  isLoading = false,
  timeRange,
  onTimeRangeChange,
  timeOptions = [
    { key: '7d', label: '7 Hari' },
    { key: '30d', label: '30 Hari' },
    { key: 'all', label: 'Semua Waktu' },
  ],
  tabs = [],
  activeTab,
  onTabChange,
  actions,
}: EnterprisePageHeaderProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  const activeTimeLabel =
    timeOptions.find((opt) => opt.key === timeRange)?.label || 'Filter';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        paddingBottom: '2px',
        minWidth: 0,
        width: '100%',
        flexShrink: 0,
      }}
    >
      {/* ── Left: Page Title & Subtitle (Auto-truncates on narrow viewports) ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
        <h1
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <span
            style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              flexShrink: 1,
            }}
            title={subtitle}
          >
            · {subtitle}
          </span>
        )}
      </div>

      {/* ── Right Controls: Sync Timestamp + Filter + Segmented Switcher + Actions (Always pinned on the right) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {/* Realtime sync trigger */}
        {syncTime && (
          <button
            type="button"
            onClick={onRefresh}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '11px',
              color: 'var(--text-muted)',
              cursor: onRefresh ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
            title="Klik untuk menyinkronkan data terbaru"
            aria-label={`Sinkronisasi data, terakhir diperbarui ${syncTime}`}
          >
            <span>{syncTime}</span>
            {onRefresh && (
              <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''} />
            )}
          </button>
        )}

        {/* Time Filter Dropdown */}
        {timeRange && onTimeRangeChange && (
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-default, #cbd5e1)',
                borderRadius: '9999px',
                cursor: 'pointer',
                height: '24px',
                lineHeight: 1,
              }}
              className="hover-bg-subtle"
              aria-expanded={isFilterOpen}
              aria-haspopup="listbox"
            >
              <Filter size={10} color="var(--text-muted)" />
              <span>{activeTimeLabel}</span>
              <ChevronDown size={10} color="var(--text-muted)" />
            </button>

            {isFilterOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  padding: '4px',
                  zIndex: 40,
                  minWidth: '110px',
                }}
                role="listbox"
              >
                {timeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      onTimeRangeChange(opt.key);
                      setIsFilterOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      color:
                        timeRange === opt.key
                          ? 'var(--color-primary)'
                          : 'var(--text-primary)',
                      fontWeight: timeRange === opt.key ? 600 : 400,
                      backgroundColor:
                        timeRange === opt.key
                          ? 'var(--bg-subtle, #f1f5f9)'
                          : 'transparent',
                    }}
                    className="hover-bg-subtle"
                    role="option"
                    aria-selected={timeRange === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Slim 26px Segmented Tab Switcher */}
        {tabs.length > 1 && onTabChange && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '9999px',
              padding: '2px',
              gap: '2px',
              height: '28px',
            }}
            role="tablist"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  style={{
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '2px 10px',
                    fontSize: '11px',
                    height: '22px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                    boxShadow: isActive ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    whiteSpace: 'nowrap',
                  }}
                  role="tab"
                  aria-selected={isActive}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      style={{
                        marginLeft: '5px',
                        fontSize: '9.5px',
                        opacity: 0.8,
                        fontWeight: 600,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Custom page actions slot (e.g. Add user, upload file, etc.) */}
        {actions}
      </div>
    </div>
  );
}
