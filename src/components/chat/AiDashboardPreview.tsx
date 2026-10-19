'use client';

import React, { useState, useCallback } from 'react';
import {
  BarChart2,
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
} from 'lucide-react';
import {
  DashboardData,
  DashboardWidget,
  StatCardWidget,
  BarChartWidget,
  ListWidget,
  TableWidget,
  TimelineWidget,
  ComparisonWidget,
  TextSummaryWidget,
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

// ─────────────────────────────────────────────────────────────
// Individual Widget Components
// ─────────────────────────────────────────────────────────────

function StatCard({ widget }: { widget: StatCardWidget }) {
  const color = widget.color || 'blue';
  const palette = CARD_COLORS[color] || CARD_COLORS.blue;
  const TrendIcon = widget.trend === 'up' ? TrendingUp : widget.trend === 'down' ? TrendingDown : Minus;
  const trendColor = widget.trend === 'up' ? 'var(--color-success)' : widget.trend === 'down' ? 'var(--color-danger)' : 'var(--text-muted)';

  return (
    <div className="db-widget db-stat-card" style={{ background: palette.gradient, borderColor: palette.border }}>
      <div className="db-stat-label">{widget.title}</div>
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

function BarChart({ widget }: { widget: BarChartWidget }) {
  const max = Math.max(...widget.items.map(i => i.value), 1);
  return (
    <div className="db-widget db-barchart">
      <div className="db-widget-title">
        <BarChart2 size={14} />
        <span>{widget.title}</span>
      </div>
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

function ListWidgetComp({ widget }: { widget: ListWidget }) {
  return (
    <div className="db-widget db-list">
      <div className="db-widget-title">
        <List size={14} />
        <span>{widget.title}</span>
      </div>
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

function TableWidgetComp({ widget }: { widget: TableWidget }) {
  return (
    <div className="db-widget db-table-widget">
      <div className="db-widget-title">
        <Table2 size={14} />
        <span>{widget.title}</span>
      </div>
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

function TimelineWidgetComp({ widget }: { widget: TimelineWidget }) {
  const STATUS_COLORS = {
    done:    { dot: 'var(--color-success)', bg: 'var(--color-success-subtle)' },
    active:  { dot: 'var(--color-primary)', bg: 'var(--color-primary-subtle)' },
    pending: { dot: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
  };
  return (
    <div className="db-widget db-timeline">
      <div className="db-widget-title">
        <Clock size={14} />
        <span>{widget.title}</span>
      </div>
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

function ComparisonWidgetComp({ widget }: { widget: ComparisonWidget }) {
  return (
    <div className="db-widget db-comparison">
      <div className="db-widget-title">
        <GitCompare size={14} />
        <span>{widget.title}</span>
      </div>
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

function TextSummaryWidgetComp({ widget }: { widget: TextSummaryWidget }) {
  return (
    <div className="db-widget db-text-summary">
      <div className="db-widget-title">
        <FileText size={14} />
        <span>{widget.title}</span>
      </div>
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
function WidgetRenderer({ widget }: { widget: DashboardWidget }) {
  switch (widget.type) {
    case 'stat_card':   return <StatCard widget={widget} />;
    case 'bar_chart':   return <BarChart widget={widget} />;
    case 'list':        return <ListWidgetComp widget={widget} />;
    case 'table':       return <TableWidgetComp widget={widget} />;
    case 'timeline':    return <TimelineWidgetComp widget={widget} />;
    case 'comparison':  return <ComparisonWidgetComp widget={widget} />;
    case 'text_summary':return <TextSummaryWidgetComp widget={widget} />;
    default:            return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard Preview (inline in chat)
// ─────────────────────────────────────────────────────────────
interface AiDashboardPreviewProps {
  data: DashboardData;
  dashboardId: string;
  onClose?: () => void;
  compact?: boolean;
}

export function AiDashboardPreview({
  data,
  dashboardId,
  onClose,
  compact = false,
}: AiDashboardPreviewProps) {
  const [copiedLink, setCopiedLink] = useState(false);
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
          <button
            type="button"
            onClick={handleOpenFull}
            className="db-icon-btn"
            title={language === 'en' ? 'Open full dashboard' : 'Buka dashboard penuh'}
          >
            <ExternalLink size={13} />
          </button>
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
          {statCards.map((w, i) => (
            <WidgetRenderer key={i} widget={w} />
          ))}
        </div>
      )}

      {/* Other widgets */}
      {otherWidgets.length > 0 && (
        <div className="db-widget-grid">
          {otherWidgets.map((w, i) => (
            <WidgetRenderer key={i} widget={w} />
          ))}
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
  onDashboardReady: (data: DashboardData, dashboardId: string) => void;
}

export function BuildDashboardButton({
  messageId,
  sessionId,
  answerText,
  queryText,
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
        body: JSON.stringify({ messageId, sessionId, answerText, queryText }),
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
          ? `Dashboard created with ${result.widgetCount} widgets!`
          : `Dashboard dibuat dengan ${result.widgetCount} widget!`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messageId, sessionId, answerText, queryText, onDashboardReady, language]);

  return (
    <button
      type="button"
      onClick={handleBuild}
      disabled={isLoading}
      className="db-build-btn"
      title={language === 'en' ? 'Convert to interactive dashboard' : 'Ubah menjadi dashboard interaktif'}
    >
      {isLoading ? (
        <Loader2 size={13} className="db-build-btn-spinner" />
      ) : (
        <LayoutDashboard size={13} />
      )}
      <span>
        {isLoading
          ? (language === 'en' ? 'Building...' : 'Membuat...')
          : (language === 'en' ? 'Dashboard' : 'Dashboard')}
      </span>
    </button>
  );
}

export default AiDashboardPreview;
