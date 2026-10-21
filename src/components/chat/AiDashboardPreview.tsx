'use client';

import React, { useState, useCallback } from 'react';
import {
  BarChart2,
  LineChart,
  PieChart,
  AreaChart,
  TrendingUp,
  TrendingDown,
  Minus,
  List,
  Table2,
  Clock,
  GitCompare,
  FileText,
  ExternalLink,
  Loader2,
  LayoutDashboard,
  Copy,
  Check,
  Share2,
  X,
  Sparkles,
  LucideIcon,
} from 'lucide-react';
import CardFloatingCopilot from '@/components/dashboard/CardFloatingCopilot';
import {
  DashboardData,
  DashboardWidget,
  StatCardWidget,
  BarChartWidget,
  LineChartWidget,
  PieChartWidget,
  AreaChartWidget,
  ListWidget,
  TableWidget,
  TimelineWidget,
  ComparisonWidget,
  TextSummaryWidget,
  MorphableChartType,
} from '@/types/dashboard';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────
// Color palette helpers
// ─────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'var(--color-primary-subtle)', text: 'var(--color-primary)', border: 'var(--color-primary-border)' },
  green:  { bg: 'var(--color-success-subtle)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
  amber:  { bg: 'var(--color-warning-subtle)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
  red:    { bg: 'var(--color-danger-subtle)', text: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
  purple: { bg: '#F3E8FF', text: '#7C3AED', border: '#DDD6FE' },
};

const CARD_COLORS: Record<string, { gradient: string; icon: string; border: string }> = {
  blue:   { gradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', icon: 'var(--color-primary)', border: 'var(--color-primary-border)' },
  green:  { gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', icon: 'var(--color-success)', border: 'var(--color-success-border)' },
  amber:  { gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', icon: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  red:    { gradient: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', icon: 'var(--color-danger)', border: 'var(--color-danger-border)' },
  purple: { gradient: 'linear-gradient(135deg, #F3E8FF 0%, #EDE9FE 100%)', icon: '#7C3AED', border: '#DDD6FE' },
};

const PIE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#64748B'
];

const CHART_SWITCHER_OPTIONS: Array<{
  type: MorphableChartType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: 'bar_chart', label: 'Bar', icon: BarChart2 },
  { type: 'line_chart', label: 'Line', icon: LineChart },
  { type: 'pie_chart', label: 'Pie', icon: PieChart },
  { type: 'area_chart', label: 'Area', icon: AreaChart },
  { type: 'table', label: 'Tabel', icon: Table2 },
];

// ─────────────────────────────────────────────────────────────
// Common Widget Header with Morph Switcher and Open/Ask AI Button
// ─────────────────────────────────────────────────────────────

function WidgetCardHeader({
  icon: Icon,
  title,
  currentType,
  onMorphTo,
  onOpenCopilot,
  isCopilotOpen,
}: {
  icon: LucideIcon;
  title: string;
  currentType?: MorphableChartType;
  onMorphTo?: (target: MorphableChartType) => void;
  onOpenCopilot?: () => void;
  isCopilotOpen?: boolean;
}) {
  return (
    <div
      className="db-widget-title"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, marginRight: '8px' }}>
        <Icon size={14} style={{ flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {onMorphTo && (
          <div className="db-chart-switcher-group" role="group" aria-label="Pilih Jenis Visualisasi">
            {CHART_SWITCHER_OPTIONS.map((opt) => {
              const OptIcon = opt.icon;
              const isActive = currentType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => onMorphTo(opt.type)}
                  className={`db-chart-switcher-btn ${isActive ? 'active' : ''}`}
                  title={`Ubah ke ${opt.label}`}
                >
                  <OptIcon size={11} />
                </button>
              );
            })}
          </div>
        )}
        {onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            className={`db-card-open-btn ${isCopilotOpen ? 'active' : ''}`}
            title={isCopilotOpen ? 'Tutup Copilot' : 'Open AI Copilot'}
          >
            <Sparkles size={11} />
            <span>{isCopilotOpen ? 'Tutup' : 'Open'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Individual Widget Components
// ─────────────────────────────────────────────────────────────

interface WidgetCommonProps {
  originalIndex: number;
  onOpenCopilot?: () => void;
  isCopilotOpen?: boolean;
}

function StatCard({
  widget,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: StatCardWidget } & WidgetCommonProps) {
  const color = widget.color || 'blue';
  const palette = CARD_COLORS[color] || CARD_COLORS.blue;
  const TrendIcon = widget.trend === 'up' ? TrendingUp : widget.trend === 'down' ? TrendingDown : Minus;
  const trendColor = widget.trend === 'up' ? 'var(--color-success)' : widget.trend === 'down' ? 'var(--color-danger)' : 'var(--text-muted)';

  return (
    <div
      className={`db-widget db-stat-card ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}
      style={{ background: palette.gradient, borderColor: palette.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div className="db-stat-label">{widget.title}</div>
        {onOpenCopilot && (
          <button
            type="button"
            onClick={onOpenCopilot}
            className={`db-card-open-btn ${isCopilotOpen ? 'active' : ''}`}
            title={isCopilotOpen ? 'Tutup Copilot' : 'Open AI Copilot'}
            style={{ padding: '1px 6px', fontSize: '10px' }}
          >
            <Sparkles size={10} />
            <span>{isCopilotOpen ? 'Tutup' : 'Open'}</span>
          </button>
        )}
      </div>
      <div className="db-stat-value" style={{ color: palette.icon }}>
        {widget.value}
        {widget.unit && <span className="db-stat-unit">{widget.unit}</span>}
      </div>
      {widget.trend && (
        <div className="db-stat-trend" style={{ color: trendColor }}>
          <TrendIcon size={12} />
          <span>{widget.trendLabel || widget.trend}</span>
        </div>
      )}
    </div>
  );
}

function BarChart({
  widget,
  onMorphTo,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: BarChartWidget; onMorphTo?: (target: MorphableChartType) => void } & WidgetCommonProps) {
  const max = Math.max(...widget.items.map(i => i.value), 1);
  return (
    <div className={`db-widget db-barchart ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={BarChart2}
        title={widget.title}
        currentType="bar_chart"
        onMorphTo={onMorphTo}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-barchart-rows">
        {widget.items.map((item, i) => (
          <div key={i} className="db-barchart-row">
            <span className="db-barchart-label">{item.label}</span>
            <div className="db-barchart-track">
              <div
                className="db-barchart-fill"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <span className="db-barchart-value">
              {item.value}{widget.unit ? ` ${widget.unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChartComp({
  widget,
  onMorphTo,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: LineChartWidget; onMorphTo?: (target: MorphableChartType) => void } & WidgetCommonProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = widget.items || [];
  const max = Math.max(...items.map((i) => i.value), 1);
  const min = Math.min(...items.map((i) => i.value), 0);
  const range = max - min || 1;

  const width = 460;
  const height = 175;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = items.map((item, i) => {
    const x = padLeft + (items.length > 1 ? (i / (items.length - 1)) * chartW : chartW / 2);
    const y = padTop + chartH - ((item.value - min) / range) * chartH;
    return { x, y, item };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const safeTitle = widget.title.replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `lineGrad-${safeTitle}`;
  const areaId = `areaGrad-${safeTitle}`;

  return (
    <div className={`db-widget db-linechart ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={LineChart}
        title={widget.title}
        currentType="line_chart"
        onMorphTo={onMorphTo}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="db-svg-chart">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((pct, idx) => {
            const y = padTop + chartH * (1 - pct);
            const val = Math.round(min + range * pct);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border-subtle, #E2E8F0)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
                  {val}
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <path
              d={`${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`}
              fill={`url(#${areaId})`}
            />
          )}

          <path
            d={pathD}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((pt, i) => {
            const isHov = hoveredIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHov ? 6 : 4}
                  fill={isHov ? '#2563EB' : '#FFFFFF'}
                  stroke="#3B82F6"
                  strokeWidth={isHov ? 2.5 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--text-secondary, #64748B)"
                  fontWeight={isHov ? '600' : '400'}
                >
                  {pt.item.label.length > 9 ? `${pt.item.label.slice(0, 8)}…` : pt.item.label}
                </text>
                {isHov && (
                  <g>
                    <rect
                      x={Math.max(10, Math.min(width - 90, pt.x - 45))}
                      y={Math.max(4, pt.y - 28)}
                      width="90"
                      height="20"
                      rx="5"
                      fill="#0F172A"
                    />
                    <text
                      x={Math.max(10, Math.min(width - 90, pt.x - 45)) + 45}
                      y={Math.max(4, pt.y - 28) + 13}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#FFFFFF"
                      fontWeight="500"
                    >
                      {pt.item.value} {widget.unit || ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function AreaChartComp({
  widget,
  onMorphTo,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: AreaChartWidget; onMorphTo?: (target: MorphableChartType) => void } & WidgetCommonProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = widget.items || [];
  const max = Math.max(...items.map((i) => i.value), 1);
  const min = Math.min(...items.map((i) => i.value), 0);
  const range = max - min || 1;

  const width = 460;
  const height = 175;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 16;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = items.map((item, i) => {
    const x = padLeft + (items.length > 1 ? (i / (items.length - 1)) * chartW : chartW / 2);
    const y = padTop + chartH - ((item.value - min) / range) * chartH;
    return { x, y, item };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const safeTitle = widget.title.replace(/[^a-zA-Z0-9]/g, '');
  const gradId = `areaStroke-${safeTitle}`;
  const fillId = `areaFill-${safeTitle}`;

  return (
    <div className={`db-widget db-areachart ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={AreaChart}
        title={widget.title}
        currentType="area_chart"
        onMorphTo={onMorphTo}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-chart-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="db-svg-chart">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((pct, idx) => {
            const y = padTop + chartH * (1 - pct);
            const val = Math.round(min + range * pct);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border-subtle, #E2E8F0)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
                  {val}
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <path
              d={`${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`}
              fill={`url(#${fillId})`}
            />
          )}

          <path
            d={pathD}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((pt, i) => {
            const isHov = hoveredIdx === i;
            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHov ? 6 : 4}
                  fill={isHov ? '#059669' : '#FFFFFF'}
                  stroke="#10B981"
                  strokeWidth={isHov ? 2.5 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--text-secondary, #64748B)"
                  fontWeight={isHov ? '600' : '400'}
                >
                  {pt.item.label.length > 9 ? `${pt.item.label.slice(0, 8)}…` : pt.item.label}
                </text>
                {isHov && (
                  <g>
                    <rect
                      x={Math.max(10, Math.min(width - 90, pt.x - 45))}
                      y={Math.max(4, pt.y - 28)}
                      width="90"
                      height="20"
                      rx="5"
                      fill="#064E3B"
                    />
                    <text
                      x={Math.max(10, Math.min(width - 90, pt.x - 45)) + 45}
                      y={Math.max(4, pt.y - 28) + 13}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#FFFFFF"
                      fontWeight="500"
                    >
                      {pt.item.value} {widget.unit || ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function PieChartComp({
  widget,
  onMorphTo,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: PieChartWidget; onMorphTo?: (target: MorphableChartType) => void } & WidgetCommonProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const items = widget.items || [];
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;

  let accumulatedAngle = 0;
  const slices = items.map((item, idx) => {
    const fraction = Math.max(0, item.value) / total;
    const angle = fraction * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;
    const endAngle = accumulatedAngle;

    const rad = (deg: number) => (deg - 90) * (Math.PI / 180);
    const rOuter = 65;
    const rInner = 40;
    const cx = 90;
    const cy = 90;

    const isFull = angle >= 359.99;
    let pathD = '';
    if (isFull) {
      pathD = `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter} M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner} A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner} Z`;
    } else {
      const x1 = cx + rOuter * Math.cos(rad(startAngle));
      const y1 = cy + rOuter * Math.sin(rad(startAngle));
      const x2 = cx + rOuter * Math.cos(rad(endAngle));
      const y2 = cy + rOuter * Math.sin(rad(endAngle));
      const x3 = cx + rInner * Math.cos(rad(endAngle));
      const y3 = cy + rInner * Math.sin(rad(endAngle));
      const x4 = cx + rInner * Math.cos(rad(startAngle));
      const y4 = cy + rInner * Math.sin(rad(startAngle));
      const largeArc = angle > 180 ? 1 : 0;
      pathD = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    }

    const color = item.color || PIE_COLORS[idx % PIE_COLORS.length];
    const pct = ((item.value / total) * 100).toFixed(1);

    return { item, pathD, color, pct, idx };
  });

  return (
    <div className={`db-widget db-piechart ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={PieChart}
        title={widget.title}
        currentType="pie_chart"
        onMorphTo={onMorphTo}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-pie-container">
        <div className="db-pie-svg-wrap">
          <svg viewBox="0 0 180 180" className="db-pie-svg">
            {slices.map((slice) => {
              const isHov = hoveredIdx === slice.idx;
              return (
                <path
                  key={slice.idx}
                  d={slice.pathD}
                  fill={slice.color}
                  opacity={hoveredIdx !== null && !isHov ? 0.45 : 1}
                  transform={isHov ? 'scale(1.04)' : 'scale(1)'}
                  style={{
                    transformOrigin: '90px 90px',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredIdx(slice.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
            <text x="90" y="85" textAnchor="middle" fontSize="10" fill="var(--text-muted, #94A3B8)" fontWeight="500">
              Total
            </text>
            <text x="90" y="103" textAnchor="middle" fontSize="14" fill="var(--text-primary, #0F172A)" fontWeight="700">
              {Math.round(total)}
            </text>
          </svg>
        </div>

        <div className="db-pie-legend">
          {slices.map((slice) => {
            const isHov = hoveredIdx === slice.idx;
            return (
              <div
                key={slice.idx}
                className={`db-pie-legend-row ${isHov ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="db-pie-legend-dot" style={{ background: slice.color }} />
                <span className="db-pie-legend-label" title={slice.item.label}>
                  {slice.item.label}
                </span>
                <span className="db-pie-legend-pct">{slice.pct}%</span>
                <span className="db-pie-legend-val">
                  {slice.item.value} {widget.unit || ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListWidgetComp({
  widget,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: ListWidget } & WidgetCommonProps) {
  return (
    <div className={`db-widget db-list ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={List}
        title={widget.title}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <ul className="db-list-items">
        {widget.items.map((item, i) => {
          const badgeColor = item.badgeColor ? BADGE_COLORS[item.badgeColor] : BADGE_COLORS.blue;
          return (
            <li key={i} className="db-list-item">
              <div className="db-list-dot" />
              <div className="db-list-content">
                <div className="db-list-item-header">
                  <span className="db-list-item-label">{item.label}</span>
                  {item.badge && (
                    <span
                      className="db-badge"
                      style={{
                        background: badgeColor.bg,
                        color: badgeColor.text,
                        border: `1px solid ${badgeColor.border}`,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="db-list-item-desc">{item.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TableWidgetComp({
  widget,
  onMorphTo,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: TableWidget; onMorphTo?: (target: MorphableChartType) => void } & WidgetCommonProps) {
  return (
    <div className={`db-widget db-table-widget ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={Table2}
        title={widget.title}
        currentType="table"
        onMorphTo={onMorphTo}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              {widget.columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widget.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimelineWidgetComp({
  widget,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: TimelineWidget } & WidgetCommonProps) {
  const STATUS_COLORS = {
    done:    { dot: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
    active:  { dot: 'var(--color-primary)', bg: 'var(--color-primary-subtle)' },
    pending: { dot: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
  };
  return (
    <div className={`db-widget db-timeline ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={Clock}
        title={widget.title}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-timeline-events">
        {widget.events.map((ev, i) => {
          const s = ev.status || 'done';
          const sc = STATUS_COLORS[s];
          return (
            <div key={i} className="db-timeline-event">
              <div className="db-timeline-line-wrap">
                <div className="db-timeline-dot" style={{ background: sc.dot }} />
                {i < widget.events.length - 1 && <div className="db-timeline-connector" />}
              </div>
              <div className="db-timeline-body">
                <span className="db-timeline-date">{ev.date}</span>
                <p className="db-timeline-title">{ev.title}</p>
                {ev.description && <p className="db-timeline-desc">{ev.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonWidgetComp({
  widget,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: ComparisonWidget } & WidgetCommonProps) {
  return (
    <div className={`db-widget db-comparison ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={GitCompare}
        title={widget.title}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              {widget.headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {widget.items.map((item, ri) => (
              <tr key={ri}>
                <td style={{ fontWeight: 600 }}>{item.label}</td>
                {widget.headers.slice(1).map((h, ci) => (
                  <td key={ci}>{item.values[h] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextSummaryWidgetComp({
  widget,
  onOpenCopilot,
  isCopilotOpen,
}: { widget: TextSummaryWidget } & WidgetCommonProps) {
  return (
    <div className={`db-widget db-text-summary ${isCopilotOpen ? 'db-widget-copilot-active' : ''}`}>
      <WidgetCardHeader
        icon={FileText}
        title={widget.title}
        onOpenCopilot={onOpenCopilot}
        isCopilotOpen={isCopilotOpen}
      />
      {widget.highlight && (
        <div className="db-text-highlight">{widget.highlight}</div>
      )}
      <p className="db-text-content">{widget.content}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Widget Router
// ─────────────────────────────────────────────────────────────
export interface WidgetRendererProps extends WidgetCommonProps {
  widget: DashboardWidget;
  onMorphTo?: (target: MorphableChartType) => void;
}

export function WidgetRenderer({
  widget,
  onMorphTo,
  ...commonProps
}: WidgetRendererProps) {
  switch (widget.type) {
    case 'stat_card':   return <StatCard widget={widget} {...commonProps} />;
    case 'bar_chart':   return <BarChart widget={widget} onMorphTo={onMorphTo} {...commonProps} />;
    case 'line_chart':  return <LineChartComp widget={widget} onMorphTo={onMorphTo} {...commonProps} />;
    case 'pie_chart':   return <PieChartComp widget={widget} onMorphTo={onMorphTo} {...commonProps} />;
    case 'area_chart':  return <AreaChartComp widget={widget} onMorphTo={onMorphTo} {...commonProps} />;
    case 'list':        return <ListWidgetComp widget={widget} {...commonProps} />;
    case 'table':       return <TableWidgetComp widget={widget} onMorphTo={onMorphTo} {...commonProps} />;
    case 'timeline':    return <TimelineWidgetComp widget={widget} {...commonProps} />;
    case 'comparison':  return <ComparisonWidgetComp widget={widget} {...commonProps} />;
    case 'text_summary':return <TextSummaryWidgetComp widget={widget} {...commonProps} />;
    default:            return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard Preview (inline in chat / dynamic dashboard)
// ─────────────────────────────────────────────────────────────
export interface AiDashboardPreviewProps {
  data: DashboardData;
  dashboardId: string;
  onClose?: () => void;
  compact?: boolean;
  onMorphWidget?: (index: number, targetType: MorphableChartType) => void;
}

export function AiDashboardPreview({
  data,
  dashboardId,
  onClose,
  compact = false,
  onMorphWidget,
}: AiDashboardPreviewProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeCopilotWidgetIndex, setActiveCopilotWidgetIndex] = useState<number | null>(null);
  const { language } = useLanguage();

  const dashboardUrl = `/dashboard/${dashboardId}`;
  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/${dashboardId}`
    : dashboardUrl;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    toast.success(language === 'en' ? 'Dashboard link copied!' : 'Link dashboard disalin!');
    setTimeout(() => setCopiedLink(false), 2000);
  }, [fullUrl, language]);

  const handleOpenFull = useCallback(() => {
    window.open(dashboardUrl, '_blank');
  }, [dashboardUrl]);

  // Split widgets: stat_cards go first row, rest below
  const statCards = data.widgets.filter(w => w.type === 'stat_card');
  const otherWidgets = data.widgets.filter(w => w.type !== 'stat_card');

  return (
    <div className={`db-preview-container ${compact ? 'db-preview-compact' : ''}`}>
      {/* Header */}
      <div className="db-preview-header">
        <div className="db-preview-header-left">
          <div className="db-preview-icon">
            <LayoutDashboard size={14} />
          </div>
          <div>
            <h3 className="db-preview-title">{data.title}</h3>
            {data.subtitle && <p className="db-preview-subtitle">{data.subtitle}</p>}
          </div>
        </div>
        <div className="db-preview-header-actions">
          <button
            type="button"
            onClick={handleCopyLink}
            className="db-icon-btn"
            title={language === 'en' ? 'Copy link' : 'Salin link'}
          >
            {copiedLink ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
          </button>
          {compact && (
            <button
              type="button"
              onClick={handleOpenFull}
              className="db-icon-btn"
              title={language === 'en' ? 'Open full dashboard' : 'Buka dashboard penuh'}
            >
              <ExternalLink size={13} />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="db-icon-btn"
              title={language === 'en' ? 'Close' : 'Tutup'}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Stat cards row */}
      {statCards.length > 0 && (
        <div className="db-stat-grid">
          {statCards.map((w, i) => {
            const originalIndex = data.widgets.indexOf(w);
            return (
              <WidgetRenderer
                key={i}
                widget={w}
                originalIndex={originalIndex}
                onOpenCopilot={() =>
                  setActiveCopilotWidgetIndex((prev) => (prev === originalIndex ? null : originalIndex))
                }
                isCopilotOpen={activeCopilotWidgetIndex === originalIndex}
              />
            );
          })}
        </div>
      )}

      {/* Other widgets */}
      {otherWidgets.length > 0 && (
        <div className="db-widget-grid">
          {otherWidgets.map((w, i) => {
            const originalIndex = data.widgets.indexOf(w);
            const isMorphable =
              w.type === 'table' ||
              w.type === 'bar_chart' ||
              w.type === 'line_chart' ||
              w.type === 'pie_chart' ||
              w.type === 'area_chart';

            const handleMorphTo = onMorphWidget && isMorphable
              ? (targetType: MorphableChartType) => {
                  onMorphWidget(originalIndex, targetType);
                }
              : undefined;

            return (
              <WidgetRenderer
                key={i}
                widget={w}
                originalIndex={originalIndex}
                onMorphTo={handleMorphTo}
                onOpenCopilot={() =>
                  setActiveCopilotWidgetIndex((prev) => (prev === originalIndex ? null : originalIndex))
                }
                isCopilotOpen={activeCopilotWidgetIndex === originalIndex}
              />
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="db-preview-footer">
        <span className="db-preview-footer-info">
          {data.widgets.length} widget{data.widgets.length > 1 ? 's' : ''}
        </span>
        <button type="button" onClick={handleOpenFull} className="db-open-btn">
          <Share2 size={11} />
          <span>{language === 'en' ? 'Open & Share Dashboard' : 'Buka & Bagikan Dashboard'}</span>
          <ExternalLink size={11} />
        </button>
      </div>

      {/* ── Floating Bottom Dock Copilot ── */}
      {activeCopilotWidgetIndex !== null && data.widgets[activeCopilotWidgetIndex] && (
        <CardFloatingCopilot
          dashboardId={dashboardId}
          dashboardData={data}
          widget={data.widgets[activeCopilotWidgetIndex]}
          widgetIndex={activeCopilotWidgetIndex}
          onMorphWidget={onMorphWidget}
          onClose={() => setActiveCopilotWidgetIndex(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// "Buat Dashboard" trigger button shown in ChatMessageItem
// ─────────────────────────────────────────────────────────────
interface BuildDashboardButtonProps {
  messageId: string;
  sessionId?: string;
  answerText: string;
  queryText?: string;
  forceRegenerate?: boolean;
  label?: string;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
  onDashboardReady: (data: DashboardData, dashboardId: string) => void;
}

export function BuildDashboardButton({
  messageId,
  sessionId,
  answerText,
  queryText,
  forceRegenerate = false,
  label,
  title,
  icon,
  className,
  onDashboardReady,
}: BuildDashboardButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();

  const handleBuild = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, sessionId, answerText, queryText, forceRegenerate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal membuat dashboard');
      }

      const result = await res.json();

      // Fetch dashboard data to render
      const dataRes = await fetch(`/api/dashboard/${result.dashboardId}`);
      if (!dataRes.ok) throw new Error('Gagal memuat data dashboard');
      const dashboardResp = await dataRes.json();

      onDashboardReady(dashboardResp.data, result.dashboardId);
      toast.success(
        language === 'en'
          ? `Dashboard ready with ${result.widgetCount} widgets!`
          : `Dashboard siap dengan ${result.widgetCount} widget!`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messageId, sessionId, answerText, queryText, forceRegenerate, onDashboardReady, language]);

  const defaultTitle = language === 'en' ? 'Convert to interactive dashboard' : 'Ubah menjadi dashboard interaktif';
  const defaultLabel = language === 'en' ? 'Dashboard' : 'Dashboard';

  return (
    <button
      type="button"
      onClick={handleBuild}
      disabled={isLoading}
      className={className || "db-build-btn"}
      title={title || defaultTitle}
    >
      {isLoading ? (
        <Loader2 size={13} className="db-build-btn-spinner" />
      ) : (
        icon || <LayoutDashboard size={13} />
      )}
      <span>
        {isLoading
          ? (language === 'en' ? 'Building...' : 'Membuat...')
          : (label || defaultLabel)}
      </span>
    </button>
  );
}

export default AiDashboardPreview;
