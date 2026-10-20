'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Copy,
  Check,
  ArrowLeft,
  Share2,
  Calendar,
  Eye,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { DashboardData, MorphableChartType } from '@/types/dashboard';
import { AiDashboardPreview } from '@/components/chat/AiDashboardPreview';
import { morphWidget } from '@/lib/utils/dashboardMorph';
import { toast } from 'sonner';

interface DashboardPageData {
  dashboardId: string;
  title: string;
  data: DashboardData;
  viewsCount: number;
  createdAt: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = typeof params?.dashboardId === 'string' ? params.dashboardId : '';

  const [pageData, setPageData] = useState<DashboardPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!dashboardId) {
      setError('Dashboard ID tidak valid.');
      setIsLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        const res = await fetch(`/api/dashboard/${dashboardId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Dashboard tidak ditemukan.');
        }
        const data = await res.json();
        setPageData(data);
      } catch (err: any) {
        setError(err?.message || 'Gagal memuat dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [dashboardId]);

  const handleCopyLink = useCallback(() => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/${dashboardId}`
      : '';
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Link dashboard disalin!');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [dashboardId]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/${dashboardId}`
      : '';
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: pageData?.title || 'Dashboard AI',
          text: 'Lihat dashboard interaktif ini dari BrilianAi',
          url,
        });
      } catch {
        // User cancelled share or not supported
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  }, [dashboardId, pageData, handleCopyLink]);

  const handleMorphWidget = useCallback(
    (index: number, targetType: MorphableChartType) => {
      setPageData((prev) => {
        if (!prev) return prev;
        const currentWidgets = [...prev.data.widgets];
        const targetWidget = currentWidgets[index];
        if (!targetWidget) return prev;

        const morphed = morphWidget(targetWidget, targetType);
        currentWidgets[index] = morphed;

        const updatedData: DashboardData = {
          ...prev.data,
          widgets: currentWidgets,
        };

        // Persist change to database in background
        fetch(`/api/dashboard/${dashboardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updatedData }),
        }).catch((err) => {
          console.warn('[DashboardPage] Failed to persist morphed widget:', err);
        });

        return {
          ...prev,
          data: updatedData,
        };
      });
    },
    [dashboardId]
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="db-page-root">
        <div className="db-page-loading">
          <Loader2 size={32} className="db-page-spinner" />
          <p>Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !pageData) {
    return (
      <div className="db-page-root">
        <div className="db-page-error">
          <AlertCircle size={48} color="var(--color-danger)" />
          <h2>Dashboard Tidak Ditemukan</h2>
          <p>{error || 'Dashboard ini mungkin telah dihapus atau link tidak valid.'}</p>
          <button
            type="button"
            className="db-back-btn"
            onClick={() => router.push('/chat')}
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Chat</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="db-page-root">
      {/* Topbar */}
      <header className="db-page-topbar">
        <div className="db-page-topbar-inner">
          <div className="db-page-topbar-left">
            <button
              type="button"
              className="db-back-btn"
              onClick={() => router.back()}
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </button>
            <div className="db-page-title-wrap">
              <div className="db-page-icon">
                <LayoutDashboard size={16} />
              </div>
              <div>
                <h1 className="db-page-title">{pageData.title}</h1>
                {pageData.data.sourceQuery && (
                  <p className="db-page-query">
                    Q: {pageData.data.sourceQuery.slice(0, 80)}
                    {pageData.data.sourceQuery.length > 80 ? '...' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="db-page-topbar-right">
            {/* Meta info */}
            <div className="db-page-meta">
              <span className="db-page-meta-item">
                <Calendar size={12} />
                {formatDate(pageData.createdAt)}
              </span>
              <span className="db-page-meta-item">
                <Eye size={12} />
                {pageData.viewsCount} views
              </span>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="db-topbar-btn db-topbar-btn-ghost"
              title="Salin link"
            >
              {copiedLink ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
              <span>{copiedLink ? 'Tersalin!' : 'Salin Link'}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="db-topbar-btn db-topbar-btn-primary"
            >
              <Share2 size={14} />
              <span>Bagikan</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="db-page-main">
        <AiDashboardPreview
          data={pageData.data}
          dashboardId={pageData.dashboardId}
          compact={false}
          onMorphWidget={handleMorphWidget}
        />
      </main>

      {/* Footer */}
      <footer className="db-page-footer">
        <p>
          Dibuat dengan <strong>BrilianAi</strong> · Dashboard Interaktif
        </p>
      </footer>
    </div>
  );
}
