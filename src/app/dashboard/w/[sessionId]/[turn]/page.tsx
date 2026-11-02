'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Share2,
  Download,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  Pencil,
  Eye,
  Check,
} from 'lucide-react';
import DraggableDashboardGrid from '@/components/dashboard/DraggableDashboardGrid';
import { DashboardData, DashboardWidget, MorphableChartType } from '@/types/dashboard';
import { morphWidget } from '@lib/utils/dashboardMorph';
import { toast } from 'sonner';

interface DashboardResponse {
  dashboardId: string;
  sessionId?: string | null;
  turnIndex?: number | null;
  userId?: string | null;
  title: string;
  data: DashboardData;
  viewsCount: number;
  createdAt: string;
  canEdit?: boolean;
  shareToken?: string;
  shareUrl?: string;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function SessionTurnDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';
  const turn = typeof params?.turn === 'string' ? params.turn : '';
  const shareParam = searchParams?.get('share') || '';

  const [pageData, setPageData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('preview');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (!sessionId || !turn) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);

    const queryUrl = `/api/dashboard/w/${sessionId}/${turn}${shareParam ? `?share=${encodeURIComponent(shareParam)}` : ''}`;

    fetch(queryUrl)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 403) {
            setIsForbidden(true);
            throw new Error(err.error || 'Akses Ditolak: Anda tidak memiliki izin untuk melihat dashboard ini.');
          }
          if (res.status === 404) {
            throw new Error(err.error || `Dashboard untuk pertanyaan ke-${turn} tidak ditemukan.`);
          }
          throw new Error(err.error || 'Gagal memuat dashboard');
        }
        return res.json();
      })
      .then((data: DashboardResponse) => {
        if (!isMounted) return;
        setPageData(data);
        if (data.canEdit) {
          setViewMode('editor');
        } else {
          setViewMode('preview');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || 'Terjadi kesalahan saat memuat dashboard.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId, turn, shareParam]);

  // Copy protected share URL to clipboard
  const handleShare = useCallback(() => {
    if (!pageData) return;
    const shareUrl =
      pageData.shareUrl ||
      `${window.location.origin}/dashboard/w/${sessionId}/${turn}${pageData.shareToken ? `?share=${pageData.shareToken}` : shareParam ? `?share=${shareParam}` : ''}`;

    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success('Link share dashboard berhasil disalin!', {
      description: 'Penerima link hanya dapat melihat dashboard ini tanpa akses ke riwayat chat lain.',
    });
    setTimeout(() => setCopiedLink(false), 2000);

    // Record audit event asynchronously
    fetch('/api/dashboard/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dashboard.share',
        dashboardId: pageData.dashboardId,
        sessionId,
        turnIndex: parseInt(turn, 10),
        title: pageData.title,
      }),
    }).catch(() => {});
  }, [pageData, sessionId, turn, shareParam]);

  // A4 Landscape Print Engine
  const handleDownloadPdf = useCallback(() => {
    if (!pageData) return;
    setIsExportingPdf(true);
    const originalMode = viewMode;
    const originalTitle = document.title;
    const cleanTitle = pageData.title
      ? `${pageData.title.replace(/[/\\?%*:|"<>]/g, '_')} - BrilianAi Dashboard Q${turn}`
      : `Dashboard Q${turn} - BrilianAi`;

    document.title = cleanTitle;

    if (viewMode !== 'preview') {
      setViewMode('preview');
    }

    toast.info('Menyiapkan format PDF A4 Landscape...', {
      description: 'Format ukuran otomatis disetel ke A4 Landscape. Pilih "Simpan sebagai PDF" pada dialog browser.',
      duration: 3500,
    });

    // Record audit event asynchronously
    fetch('/api/dashboard/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dashboard.export_pdf',
        dashboardId: pageData.dashboardId,
        sessionId,
        turnIndex: parseInt(turn, 10),
        title: pageData.title,
      }),
    }).catch(() => {});

    setTimeout(() => {
      window.print();
      setIsExportingPdf(false);
      setTimeout(() => {
        document.title = originalTitle;
        if (originalMode !== 'preview') {
          setViewMode(originalMode);
        }
      }, 1000);
    }, 300);
  }, [pageData, viewMode, turn, sessionId]);

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
        const res = await fetch(`/api/dashboard/w/${sessionId}/${turn}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updatedData }),
        });

        if (!res.ok) throw new Error('Gagal menyimpan layout');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err) {
        console.error('[SessionTurnDashboard] Failed to persist layout:', err);
        setSaveStatus('idle');
      }
    },
    [sessionId, turn, pageData]
  );

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
      await fetch(`/api/dashboard/w/${sessionId}/${turn}`, {
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
  }, [sessionId, turn, pageData]);

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

        fetch(`/api/dashboard/w/${sessionId}/${turn}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: updatedData }),
        }).catch((err) => {
          console.warn('[SessionTurnDashboard] Failed to persist morphed widget:', err);
        });

        return {
          ...prev,
          data: updatedData,
        };
      });
    },
    [sessionId, turn]
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="db-page-root">
        <div className="db-page-loading">
          <Loader2 size={32} className="db-page-spinner" />
          <p>Memuat dashboard pertanyaan ke-{turn}...</p>
        </div>
      </div>
    );
  }

  // ── Forbidden state (IDOR Protected) ──
  if (isForbidden) {
    return (
      <div className="db-page-root">
        <div className="db-page-error">
          <ShieldAlert size={52} color="#DC2626" />
          <h2 style={{ color: '#0F172A', marginTop: '12px' }}>Akses Ditolak (403 Forbidden)</h2>
          <p style={{ maxWidth: '440px', lineHeight: 1.5 }}>
            Anda tidak memiliki izin untuk melihat dashboard pertanyaan ke-<strong>{turn}</strong> di ruangan chat ini.
            Link mungkin tidak sah, tanda tangan kunci (signature) salah, atau pemilik belum membagikan pertanyaan ini kepada Anda.
          </p>
          <button
            type="button"
            className="db-back-btn"
            onClick={() => router.push('/chat')}
            style={{ marginTop: '16px' }}
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Chat Utama</span>
          </button>
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
          <p>{error || 'Dashboard untuk pertanyaan ini belum dibuat atau link tidak valid.'}</p>
          <button
            type="button"
            className="db-back-btn"
            onClick={() => router.push(`/chat/w/${sessionId}`)}
          >
            <ArrowLeft size={14} />
            <span>Kembali ke Ruang Chat</span>
          </button>
        </div>
      </div>
    );
  }

  const canEdit = Boolean(pageData.canEdit);
  const isEditing = canEdit && viewMode === 'editor';

  return (
    <div className="db-page-root">
      {/* ── Neo-Editorial Topbar ── */}
      <header className="db-page-topbar">
        <div className="db-page-topbar-inner">
          {/* Left Column: Status / Back to Chat */}
          <div className="db-topbar-col-left">
            {canEdit ? (
              <button
                type="button"
                onClick={() => router.push(`/chat/w/${sessionId}`)}
                className="db-clean-btn"
                title="Kembali ke Ruang Chat"
              >
                <ArrowLeft size={12} />
                <span>Ruang Chat</span>
              </button>
            ) : null}

            {isEditing && saveStatus === 'saving' && (
              <div className="db-save-indicator">
                <Loader2 size={11} className="db-page-spinner" />
                <span>Menyimpan...</span>
              </div>
            )}
            {isEditing && saveStatus === 'saved' && (
              <div className="db-save-indicator saved">
                <Check size={11} />
                <span>Tersimpan</span>
              </div>
            )}
          </div>

          {/* Center Column: Title & Question Turn Badge */}
          <div className="db-topbar-col-center">
            <h1 className="db-center-title" title={pageData.title}>
              {pageData.title}
            </h1>
            <p className="db-center-query">
              Pertanyaan #{turn} · {formatDate(pageData.createdAt)}
            </p>
          </div>

          {/* Right Column: Tools & Share */}
          <div className="db-topbar-col-right">
            {canEdit ? (
              <>
                {/* Rapikan Grid */}
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleResetGrid}
                    className="db-clean-btn"
                    title="Kembalikan ukuran dan susunan widget ke posisi standar yang rapi"
                  >
                    <RotateCcw size={12} />
                    <span>Rapikan Grid</span>
                  </button>
                )}

                {/* Segmented Switcher [ Editor | Pratinjau ] */}
                <div className="db-view-segmented" role="group" aria-label="Mode Tampilan Dashboard">
                  <button
                    type="button"
                    className={`db-segmented-tab ${viewMode === 'editor' ? 'active' : ''}`}
                    onClick={() => setViewMode('editor')}
                    title="Mode Editor: Atur tata letak, ukuran card, dan asisten AI"
                  >
                    <Pencil size={11} />
                    <span>Editor</span>
                  </button>
                  <button
                    type="button"
                    className={`db-segmented-tab ${viewMode === 'preview' ? 'active' : ''}`}
                    onClick={() => setViewMode('preview')}
                    title="Pratinjau: Tampilan bersih yang dilihat oleh pengunjung"
                  >
                    <Eye size={11} />
                    <span>Pratinjau</span>
                  </button>
                </div>

                {/* Download PDF Button */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="db-clean-btn"
                  title="Download Dashboard dalam format PDF A4 Landscape"
                >
                  {isExportingPdf ? (
                    <Loader2 size={12} className="db-page-spinner" />
                  ) : (
                    <Download size={12} />
                  )}
                  <span>{isExportingPdf ? 'Menyiapkan...' : 'Download PDF'}</span>
                </button>

                {/* Protected Share Button */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="db-clean-btn"
                  title="Salin link share terproteksi"
                >
                  <Share2 size={12} />
                  <span>{copiedLink ? 'Tersalin!' : 'Bagikan'}</span>
                </button>
              </>
            ) : (
              <>
                <span className="db-view-only-badge">
                  <Eye size={12} />
                  <span>Mode Lihat Saja</span>
                </span>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="db-clean-btn"
                  title="Download Dashboard dalam format PDF A4 Landscape"
                >
                  {isExportingPdf ? (
                    <Loader2 size={12} className="db-page-spinner" />
                  ) : (
                    <Download size={12} />
                  )}
                  <span>{isExportingPdf ? 'Menyiapkan...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="db-clean-btn"
                  title="Bagikan dashboard ini"
                >
                  <Share2 size={12} />
                  <span>{copiedLink ? 'Tersalin!' : 'Bagikan'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="db-page-main">
        <DraggableDashboardGrid
          dashboardId={pageData.dashboardId}
          data={pageData.data}
          isLocked={!isEditing}
          canEdit={isEditing}
          onUpdateData={handleUpdateData}
          onMorphWidget={handleMorphWidget}
          onPersistLayout={handlePersistWidgets}
        />
      </main>

      {/* Footer */}
      <footer className="db-page-footer">
        <p>
          Dibuat dengan <strong>BrilianAi</strong> · Dashboard Interaktif (Pertanyaan #{turn})
        </p>
      </footer>
    </div>
  );
}

export default function SessionTurnDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="db-page-root">
          <div className="db-page-loading">
            <Loader2 size={32} className="db-page-spinner" />
            <p>Menyiapkan dashboard...</p>
          </div>
        </div>
      }
    >
      <SessionTurnDashboardContent />
    </Suspense>
  );
}
