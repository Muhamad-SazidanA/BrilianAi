'use client';

import React, { useState } from 'react';
import { ActivityTrend } from '@/types/stats';

interface CompactActivityMatrixProps {
  trend?: ActivityTrend;
  isLoading?: boolean;
}

export default function CompactActivityMatrix({ trend, isLoading = false }: CompactActivityMatrixProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = trend?.points || [];
  const topTopics = trend?.topTopics || [];
  const totalCurrent = trend?.totalCurrent || 0;
  const changePercentage = trend?.changePercentage ?? 0;

  // Sparkline dimensions
  const sparkWidth = 340;
  const sparkHeight = 50;
  const padX = 10;
  const padY = 6;

  const maxVal = Math.max(4, ...points.map((p) => p.current));

  const getX = (idx: number) => {
    if (points.length <= 1) return sparkWidth / 2;
    return padX + (idx / (points.length - 1)) * (sparkWidth - 2 * padX);
  };

  const getY = (val: number) => {
    return sparkHeight - padY - (val / maxVal) * (sparkHeight - 2 * padY);
  };

  const sparkPathD = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.current)}`).join(' ')
    : '';

  const areaPathD = points.length > 0
    ? `${sparkPathD} L ${getX(points.length - 1)} ${sparkHeight} L ${getX(0)} ${sparkHeight} Z`
    : '';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
        gap: '0.85rem',
      }}
      className="dashboard-trend-grid"
    >
      {/* ── CARD A: Sparkline Activity ── */}
      <div
        className="enterprise-card"
        style={{
          padding: '14px 16px',
          justifyContent: 'space-between',
          minHeight: '160px',
        }}
      >
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Aktivitas Kueri AI
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· 7 hari</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'var(--text-primary)',
                  fontFeatureSettings: '"tnum"',
                  whiteSpace: 'nowrap',
                }}
              >
                {isLoading ? '...' : `${totalCurrent} Kueri`}
              </span>
              {!isLoading && (
                <span
                  className={`badge ${changePercentage >= 0 ? 'badge-success' : 'badge-neutral'}`}
                  style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '9999px', fontWeight: 600 }}
                >
                  {changePercentage >= 0 ? `+${changePercentage}%` : `${changePercentage}%`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sparkline (Height 50px) */}
        <div style={{ position: 'relative', width: '100%', height: `${sparkHeight}px`, marginTop: '10px' }}>
          <svg
            viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Gradient Area under curve */}
            {areaPathD && <path d={areaPathD} fill="url(#sparkGradient)" />}

            {/* Line curve */}
            {sparkPathD && (
              <path
                d={sparkPathD}
                fill="none"
                stroke="#2563EB"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Micro dots */}
            {points.map((p, i) => {
              const x = getX(i);
              const y = getY(p.current);
              const isHovered = hoveredIdx === i;

              return (
                <circle
                  key={p.date}
                  cx={x}
                  cy={y}
                  r={isHovered ? 4 : 2.5}
                  fill={isHovered ? '#2563EB' : '#ffffff'}
                  stroke="#2563EB"
                  strokeWidth={1.5}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{ cursor: 'pointer', transition: 'r 0.12s ease' }}
                />
              );
            })}
          </svg>

          {/* Micro hover tooltip */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <div
              style={{
                position: 'absolute',
                top: '-24px',
                left: `${(getX(hoveredIdx) / sparkWidth) * 100}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 10,
              }}
            >
              {points[hoveredIdx].label}: {points[hoveredIdx].current} kueri
            </div>
          )}
        </div>

        {/* Sparkline Day Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: `0 ${padX}px`, marginTop: '6px' }}>
          {points.map((p) => (
            <span key={p.date} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── CARD B: Semantic Knowledge Topics ── */}
      <div
        className="enterprise-card"
        style={{
          padding: '14px 16px',
          justifyContent: 'space-between',
          minHeight: '160px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Topik Pengetahuan Teraktif
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Semantik RAG</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                {[1, 2, 3].map((n) => (
                  <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="skeleton-shimmer" style={{ width: '50%', height: '11px' }} />
                      <span className="skeleton-shimmer" style={{ width: '20px', height: '11px' }} />
                    </div>
                    <span className="skeleton-shimmer" style={{ width: '100%', height: '4px', borderRadius: '9999px' }} />
                  </div>
                ))}
              </div>
            ) : topTopics.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
                Belum ada kueri audit tercatat.
              </div>
            ) : (
              topTopics.slice(0, 3).map((t) => (
                <div key={t.topic}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={t.topic}
                    >
                      {t.topic}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontFeatureSettings: '"tnum"' }}>
                      {t.percentage}%
                    </span>
                  </div>

                  {/* Micro-bar */}
                  <div
                    style={{
                      width: '100%',
                      height: '3.5px',
                      backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(6, t.percentage))}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-primary, #2563EB)',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Distribusi rujukan dokumen dari percakapan pengguna
        </div>
      </div>
    </div>
  );
}
