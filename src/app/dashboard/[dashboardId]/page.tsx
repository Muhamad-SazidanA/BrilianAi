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
  Lock,
  Unlock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DashboardData, DashboardWidget, MorphableChartType } from '@/types/dashboard';
import DraggableDashboardGrid from '@/components/dashboard/DraggableDashboardGrid';
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
  const [isLayoutLocked, setIsLayoutLocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

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
        setIsLayoutLocked(Boolean(data.data?.isLayoutLocked));
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
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  }, [dashboardId, pageData, handleCopyLink]);

  // Persist updated widgets layout to database
  const handlePersistWidgets = useCallback(
    async (updatedWidgets: DashboardWidget[]) => {
      if (!pageData) return;
      setSaveStatus('saving');

      const updatedData: DashboardData = {
        ...pageData.data,
        widgets: updatedWidgets,
      };

      try {
        const res = await fetch(`/api/dashboard/${dashboardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updatedData }),
        });

        if (!res.ok) throw new Error('Gagal menyimpan layout');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err) {
        console.error('[DashboardPage] Failed to persist layout:', err);
        setSaveStatus('idle');
      }
    },
    [dashboardId, pageData]
  );

  // Toggle Lock/Unlock layout
  const handleToggleLockLayout = useCallback(async () => {
    if (!pageData) return;
    const nextLocked = !isLayoutLocked;
    setIsLayoutLocked(nextLocked);
    setSaveStatus('saving');

    const updatedData: DashboardData = {
      ...pageData.data,
      isLayoutLocked: nextLocked,
    };
    setPageData((prev) => (prev ? { ...prev, data: updatedData } : prev));

    try {
      await fetch(`/api/dashboard/${dashboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      if (nextLocked) {
        toast.success('Layout dashboard dikunci.');
      } else {
        toast.info('Mode atur layout aktif: tarik blok untuk pindah posisi atau sudut untuk resize.');
      }
    } catch {
      setSaveStatus('idle');
      toast.error('Gagal memperbarui status kunci layout');
    }
  }, [dashboardId, isLayoutLocked, pageData]);

  // Reset layout to tidy default
  const handleResetGrid = useCallback(async () => {
    if (!pageData) return;
    const cleanedWidgets = pageData.data.widgets.map((w) => {
      const { layout, ...rest } = w;
      return rest;
    });

    const updatedData: DashboardData = {
      ...pageData.data,
      widgets: cleanedWidgets,
    };
    setPageData((prev) => (prev ? { ...prev, data: updatedData } : prev));
    setSaveStatus('saving');

    try {
      await fetch(`/api/dashboard/${dashboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
      toast.success('Grid berhasil dirapikan ke susunan standar!');
    } catch {
      setSaveStatus('idle');
      toast.error('Gagal merapikan grid');
    }
  }, [dashboardId, pageData]);

  const handleUpdateData = useCallback((newData: DashboardData) => {
    setPageData((prev) => (prev ? { ...prev, data: newData } : prev));
  }, []);

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

            {/* Auto-save status indicator */}
            {saveStatus === 'saving' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  color: '#64748B',
                }}
              >
                <Loader2 size={12} className="db-page-spinner" />
                <span>Menyimpan...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#10B981',
                  fontWeight: 500,
                }}
              >
                <Check size={13} />
                <span>Tersimpan</span>
              </div>
            )}

            {/* Salin link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="db-topbar-btn db-topbar-btn-ghost"
              title="Salin link"
            >
              {copiedLink ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
              <span>{copiedLink ? 'Tersalin!' : 'Salin Link'}</span>
            </button>

            {/* Kunci / Buka Kunci Layout */}
            <button
              type="button"
              onClick={handleToggleLockLayout}
              className={`db-topbar-btn ${isLayoutLocked ? 'db-topbar-btn-ghost' : 'db-topbar-btn-primary'}`}
              title={isLayoutLocked ? 'Buka kunci untuk memindah / ubah ukuran widget' : 'Kunci layout agar tidak sengaja bergeser'}
              style={{
                backgroundColor: isLayoutLocked ? 'transparent' : '#2563EB',
                color: isLayoutLocked ? 'var(--text-secondary)' : '#FFFFFF',
              }}
            >
              {isLayoutLocked ? <Lock size={13} /> : <Unlock size={13} />}
              <span>{isLayoutLocked ? 'Buka Kunci' : 'Kunci Layout'}</span>
            </button>

            {/* Rapikan Grid */}
            <button
              type="button"
              onClick={handleResetGrid}
              className="db-topbar-btn db-topbar-btn-ghost"
              title="Kembalikan ukuran dan susunan widget ke posisi standar yang rapi"
            >
              <RotateCcw size={13} />
              <span>Rapikan Grid</span>
            </button>

            {/* Bagikan */}
            <button
              type="button"
              onClick={handleShare}
              className="db-topbar-btn db-topbar-btn-ghost"
            >
              <Share2 size={13} />
              <span>Bagikan</span>
            </button>
          </div>
        </div>
      </header>

      {/* Helper Banner when Unlocked */}
      {!isLayoutLocked && (
        <div className="db-layout-hint-bar">
          <Sparkles size={13} style={{ color: '#2563EB', flexShrink: 0 }} />
          <span>
            + Drag widget untuk memindahkan · Tarik sudut kanan bawah untuk resize · Layout tersimpan otomatis
          </span>
        </div>
      )}

      {/* Dashboard Draggable & Resizable Grid */}
      <main className="db-page-main">
        <DraggableDashboardGrid
          dashboardId={pageData.dashboardId}
          data={pageData.data}
          isLocked={isLayoutLocked}
          onUpdateData={handleUpdateData}
          onMorphWidget={handleMorphWidget}
          onPersistLayout={handlePersistWidgets}
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
