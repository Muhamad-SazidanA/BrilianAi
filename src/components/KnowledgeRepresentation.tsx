'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Pencil,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────── */
export interface RawChunkItem {
  id: number | string;
  chunk_index: number;
  content: string;
  source_page_start: number;
  source_page_end: number;
  created_at?: string;
}

export interface CuratedInsightItem {
  id: number | string;
  upload_batch_id: string;
  title: string;
  content: string;
  importance: 'high' | 'medium' | 'low';
  category: string;
  tags: string[];
  source_pages: string;
  source_chunk_id?: number | string | null;
  created_at?: string;
}

interface KnowledgeRepresentationProps {
  batchId: string;
  filename: string;
  rawChunks: RawChunkItem[];
  curatedInsights: CuratedInsightItem[];
  onRefreshCurated: () => Promise<void>;
}

/* ═══════════════════════════════════════════════════════════
   KnowledgeRepresentation Component
   ═══════════════════════════════════════════════════════════ */
export default function KnowledgeRepresentation({
  batchId,
  filename,
  rawChunks,
  curatedInsights,
  onRefreshCurated,
}: KnowledgeRepresentationProps) {
  const [activeTab, setActiveTab] = useState<'curated' | 'raw'>('curated');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCurating, setIsCurating] = useState<boolean>(false);
  const [curationError, setCurationError] = useState<string | null>(null);

  // Edit Modal State
  const [editingInsight, setEditingInsight] = useState<CuratedInsightItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editImportance, setEditImportance] = useState<'high' | 'medium' | 'low'>('medium');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editTagsString, setEditTagsString] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Pagination State
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [rawPage, setRawPage] = useState<number>(1);
  const [curatedPage, setCuratedPage] = useState<number>(1);

  // Trigger AI Curation for this batch
  const handleRunAiCuration = async () => {
    if (isCurating) return;
    setIsCurating(true);
    setCurationError(null);

    try {
      const res = await fetch(`/api/documents/${batchId}/curate?limit=25`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memproses kurasi AI');
      }
      await onRefreshCurated();
      setActiveTab('curated');
    } catch (err: any) {
      setCurationError(err.message || 'Terjadi kesalahan saat kurasi.');
    } finally {
      setIsCurating(false);
    }
  };

  // Otomatis jalankan kurasi AI sampai seluruh chunks mentah terkurasi
  useEffect(() => {
    if (
      batchId &&
      rawChunks.length > 0 &&
      curatedInsights.length < rawChunks.length &&
      !isCurating
    ) {
      const timer = setTimeout(() => {
        handleRunAiCuration();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [batchId, rawChunks.length, curatedInsights.length, isCurating]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live auto-refresh polling saat kurasi AI sedang berlangsung
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isCurating) {
      timer = setInterval(() => {
        onRefreshCurated();
      }, 3500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCurating, onRefreshCurated]);

  // Beralih ke tab 'curated' secara otomatis saat insight kurasi sudah siap
  useEffect(() => {
    if (curatedInsights.length > 0 && activeTab === 'raw') {
      setActiveTab('curated');
    }
  }, [curatedInsights.length, activeTab]);

  // Open Edit Modal for Curated Insight
  const openEditModal = (insight: CuratedInsightItem) => {
    setEditingInsight(insight);
    setEditTitle(insight.title);
    setEditContent(insight.content);
    setEditImportance(insight.importance);
    setEditCategory(insight.category || 'ringkasan');
    setEditTagsString(Array.isArray(insight.tags) ? insight.tags.join(', ') : '');
  };

  // Save Curated Insight edit
  const handleSaveEdit = async () => {
    if (!editingInsight) return;
    setIsSavingEdit(true);

    try {
      const tagsArray = editTagsString
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/documents/${batchId}/curate/${editingInsight.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          importance: editImportance,
          category: editCategory,
          tags: tagsArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memperbarui insight');
      }

      await onRefreshCurated();
      setEditingInsight(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Reset page to 1 when search or pageSize changes
  useEffect(() => {
    setRawPage(1);
    setCuratedPage(1);
  }, [searchQuery, pageSize]);

  // Filter items
  const filteredRaw = rawChunks.filter(
    (c) =>
      c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `halaman ${c.source_page_start}-${c.source_page_end}`.includes(searchQuery.toLowerCase())
  );

  const filteredCurated = curatedInsights.filter((i) => {
    const q = searchQuery.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q) ||
      (i.category && i.category.toLowerCase().includes(q)) ||
      (i.tags && i.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  // Pagination calculations
  const rawTotal = filteredRaw.length;
  const rawLimit = pageSize === 'all' ? rawTotal : pageSize;
  const rawTotalPages = Math.max(1, Math.ceil(rawTotal / (rawLimit || 1)));
  const paginatedRaw =
    pageSize === 'all'
      ? filteredRaw
      : filteredRaw.slice((rawPage - 1) * (pageSize as number), rawPage * (pageSize as number));

  const curatedTotal = filteredCurated.length;
  const curatedLimit = pageSize === 'all' ? curatedTotal : pageSize;
  const curatedTotalPages = Math.max(1, Math.ceil(curatedTotal / (curatedLimit || 1)));
  const paginatedCurated =
    pageSize === 'all'
      ? filteredCurated
      : filteredCurated.slice((curatedPage - 1) * (pageSize as number), curatedPage * (pageSize as number));

  const totalChunksCount = rawChunks.length + curatedInsights.length;

  // Pagination Controls Renderer (sesuai design.md §5)
  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (p: number) => void
  ) => {
    const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? totalItems : (pageSize as number)) + 1;
    const endIdx = pageSize === 'all' ? totalItems : Math.min(currentPage * (pageSize as number), totalItems);

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 0 6px',
        }}
      >
        {/* Info kiri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span className="type-meta">
            Menampilkan <span className="type-data">{startIdx}–{endIdx}</span> dari{' '}
            <span className="type-data">{totalItems}</span>
          </span>

          {/* Segmented limit buttons */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <span
              className="type-meta"
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                borderRight: '1px solid var(--color-hairline)',
                backgroundColor: 'var(--color-mist)',
              }}
            >
              Limit
            </span>
            {([10, 20, 50, 100, 'all'] as const).map((size, idx) => {
              const isSelected = pageSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setRawPage(1);
                    setCuratedPage(1);
                  }}
                  style={{
                    padding: '2px 8px',
                    border: 'none',
                    borderLeft: idx > 0 ? '1px solid var(--color-hairline)' : 'none',
                    backgroundColor: isSelected ? 'var(--color-mist)' : 'transparent',
                    color: isSelected ? 'var(--color-ink)' : 'var(--color-slate)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'background-color 0.1s',
                  }}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kontrol kanan: Prev / Next */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn btn--outline btn--icon-sm"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>

            <span className="type-data" style={{ fontSize: '12px', padding: '0 4px' }}>
              Hal {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="btn btn--outline btn--icon-sm"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        backgroundColor: 'var(--color-paper)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 className="type-section-title">Representasi pengetahuan</h2>
          <span className="type-data" style={{ fontSize: '13px' }}>
            ({totalChunksCount} chunks)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`/api/documents/${batchId}/export`}
            download
            className="btn btn--outline btn--sm"
            aria-label="Export representasi pengetahuan"
          >
            <ArrowDownToLine size={14} strokeWidth={1.5} />
            Export
          </a>

          <button
            type="button"
            onClick={() => alert('Fitur impor representasi data siap dikonfigurasi.')}
            className="btn btn--outline btn--sm"
            aria-label="Import representasi pengetahuan"
          >
            <ArrowUpFromLine size={14} strokeWidth={1.5} />
            Import
          </button>

          {rawChunks.length > 0 && (
            <button
              type="button"
              onClick={handleRunAiCuration}
              disabled={isCurating}
              className="btn btn--solid btn--sm"
              aria-label="Jalankan kurasi AI"
            >
              {isCurating ? (
                <>
                  <div
                    className="spinner"
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                    }}
                  />
                  Mengurasi (+25 chunks)...
                </>
              ) : curatedInsights.length === 0 ? (
                'Jalankan kurasi AI (+25 chunks)'
              ) : (
                'Kurasi lagi (+25 chunks)'
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Progress status banner ─────────────────────────── */}
      {isCurating && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            marginBottom: '1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-mist)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div
            className="spinner"
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid var(--color-hairline)',
              borderTopColor: 'var(--color-accent)',
              borderRadius: '50%',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, fontSize: '13px', lineHeight: '18px', color: 'var(--color-ink)' }}>
            <strong>Kurasi AI berjalan (Llama 3.2):</strong>{' '}
            <span className="type-data">
              {curatedInsights.length}/{rawChunks.length} chunks
            </span>{' '}
            (
            <span className="type-data">
              {rawChunks.length > 0 ? Math.round((curatedInsights.length / rawChunks.length) * 100) : 0}%
            </span>
            ) terkurasi. Data diperbarui otomatis.
          </div>
        </div>
      )}

      {/* ── 100% completion status (sesuai design.md: baris flex, ikon CheckCircle2, bukan kotak hijau) ── */}
      {!isCurating && rawChunks.length > 0 && curatedInsights.length >= rawChunks.length && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1rem',
          }}
        >
          <CheckCircle2 size={16} strokeWidth={1.5} color="var(--color-success)" style={{ flexShrink: 0 }} />
          <span className="type-meta">
            Kurasi AI selesai:{' '}
            <span className="type-data">
              {curatedInsights.length}/{rawChunks.length}
            </span>{' '}
            chunks mentah telah terkurasi menjadi insight terstruktur.
          </span>
        </div>
      )}

      {/* ── Error message ──────────────────────────────────── */}
      {curationError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            marginBottom: '1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(214, 69, 69, 0.06)',
            border: '1px solid rgba(214, 69, 69, 0.2)',
            color: 'var(--color-danger)',
            fontSize: '13px',
            lineHeight: '18px',
          }}
        >
          <AlertCircle size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          <span>{curationError}</span>
        </div>
      )}

      {/* ── Chunk tabs (sesuai design.md: dua tab underline) ─ */}
      <div className="tab-bar" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('curated')}
          className={`tab-item${activeTab === 'curated' ? ' tab-item--active' : ''}`}
        >
          Insight kurasi{' '}
          <span className="type-data" style={{ fontSize: '12px', marginLeft: '4px' }}>
            ({curatedInsights.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('raw')}
          className={`tab-item${activeTab === 'raw' ? ' tab-item--active' : ''}`}
        >
          Konten mentah{' '}
          <span className="type-data" style={{ fontSize: '12px', marginLeft: '4px' }}>
            ({rawChunks.length})
          </span>
        </button>
      </div>

      {/* ── Search bar with Search icon ────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div className="input-icon-wrap">
          <Search size={16} strokeWidth={1.5} className="input-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari dalam chunks..."
            className="input-field"
          />
        </div>
      </div>

      {/* ── TAB 1: Insight Kurasi ───────────────────────────── */}
      {activeTab === 'curated' && (
        <div>
          {curatedInsights.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                border: '1px dashed var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-mist)',
              }}
            >
              <p className="type-card-title" style={{ marginBottom: '4px' }}>
                Belum ada insight kurasi
              </p>
              <p className="type-meta" style={{ maxWidth: '440px', margin: '0 auto 1rem' }}>
                Jalankan kurasi AI untuk mengekstrak data penting, tabel, dan kategori prioritas secara terstruktur.
              </p>
              <button
                type="button"
                onClick={handleRunAiCuration}
                disabled={isCurating || rawChunks.length === 0}
                className="btn btn--solid btn--sm"
              >
                {isCurating ? 'Sedang memproses kurasi...' : 'Mulai kurasi AI (+25 chunk pertama)'}
              </button>
            </div>
          ) : filteredCurated.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <p className="type-meta">Tidak ada insight kurasi yang cocok dengan pencarian.</p>
            </div>
          ) : (
            <>
              {renderPaginationControls(curatedPage, curatedTotalPages, curatedTotal, setCuratedPage)}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '12px',
                  marginTop: '0.75rem',
                }}
              >
                {paginatedCurated.map((item) => {
                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--color-hairline)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-paper)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Top: Title, Importance, Edit button */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '8px',
                            marginBottom: '6px',
                          }}
                        >
                          <h3 className="type-card-title" style={{ margin: 0, lineHeight: '20px' }}>
                            {item.title}
                          </h3>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <span
                              className="stat-chip"
                              style={{
                                color:
                                  item.importance === 'high'
                                    ? 'var(--color-danger)'
                                    : item.importance === 'medium'
                                    ? 'var(--color-warning)'
                                    : 'var(--color-slate)',
                                borderColor:
                                  item.importance === 'high'
                                    ? 'rgba(214, 69, 69, 0.3)'
                                    : item.importance === 'medium'
                                    ? 'rgba(183, 121, 31, 0.3)'
                                    : 'var(--color-hairline)',
                              }}
                            >
                              {item.importance}
                            </span>

                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="btn btn--ghost btn--icon-sm"
                              aria-label="Edit insight kurasi"
                              title="Edit insight kurasi"
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        {/* Content */}
                        <div
                          className="type-body"
                          style={{
                            fontSize: '13px',
                            lineHeight: '20px',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {item.content}
                        </div>
                      </div>

                      {/* Bottom meta row */}
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--color-hairline)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {item.category && (
                          <span className="stat-chip">
                            {item.category}
                          </span>
                        )}

                        {item.source_pages && (
                          <span className="stat-chip">
                            hal. {item.source_pages}
                          </span>
                        )}

                        {Array.isArray(item.tags) &&
                          item.tags.map((tag, idx) => (
                            <span key={idx} className="stat-chip">
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {renderPaginationControls(curatedPage, curatedTotalPages, curatedTotal, setCuratedPage)}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: Konten Mentah ────────────────────────────── */}
      {activeTab === 'raw' && (
        <div>
          {filteredRaw.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <p className="type-meta">Tidak ada konten mentah yang cocok dengan pencarian.</p>
            </div>
          ) : (
            <>
              {renderPaginationControls(rawPage, rawTotalPages, rawTotal, setRawPage)}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '12px',
                  marginTop: '0.75rem',
                }}
              >
                {paginatedRaw.map((chunk) => {
                  const pageLabel =
                    chunk.source_page_start === chunk.source_page_end
                      ? `Halaman ${chunk.source_page_start}`
                      : `Halaman ${chunk.source_page_start}–${chunk.source_page_end}`;

                  return (
                    <div
                      key={chunk.id}
                      style={{
                        border: '1px solid var(--color-hairline)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-paper)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Top: page label + chunk chip */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          <h3 className="type-card-title" style={{ margin: 0 }}>
                            {pageLabel}
                          </h3>
                          <span className="stat-chip">
                            chunk #{chunk.chunk_index + 1}
                          </span>
                        </div>

                        {/* Content */}
                        <div
                          className="type-body"
                          style={{
                            fontSize: '13px',
                            lineHeight: '20px',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {chunk.content}
                        </div>
                      </div>

                      {/* Bottom meta row */}
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--color-hairline)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span className="type-data" style={{ fontSize: '11px' }}>
                          {chunk.content.length} karakter
                        </span>
                        <span className="stat-chip">mentah</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {renderPaginationControls(rawPage, rawTotalPages, rawTotal, setRawPage)}
            </>
          )}
        </div>
      )}

      {/* ── Edit Curated Insight Modal ─────────────────────── */}
      {editingInsight && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(20, 22, 27, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={() => setEditingInsight(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(20, 22, 27, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 className="type-card-title">Edit insight kurasi</h3>
              <button
                type="button"
                onClick={() => setEditingInsight(null)}
                className="btn btn--ghost btn--icon-sm"
                aria-label="Tutup modal"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="type-meta" style={{ display: 'block', marginBottom: '4px' }}>
                  Judul insight
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="type-meta" style={{ display: 'block', marginBottom: '4px' }}>
                    Tingkat kepentingan
                  </label>
                  <select
                    value={editImportance}
                    onChange={(e) => setEditImportance(e.target.value as any)}
                    className="input-field"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="high">High (Tinggi / Kritis)</option>
                    <option value="medium">Medium (Sedang)</option>
                    <option value="low">Low (Rendah / Umum)</option>
                  </select>
                </div>

                <div>
                  <label className="type-meta" style={{ display: 'block', marginBottom: '4px' }}>
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="type-meta" style={{ display: 'block', marginBottom: '4px' }}>
                  Tags (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={editTagsString}
                  onChange={(e) => setEditTagsString(e.target.value)}
                  placeholder="Contoh: Finansial, Regulasi, 2024"
                  className="input-field"
                />
              </div>

              <div>
                <label className="type-meta" style={{ display: 'block', marginBottom: '4px' }}>
                  Isi konten
                </label>
                <textarea
                  rows={5}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '1.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => setEditingInsight(null)}
                className="btn btn--outline btn--sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editTitle.trim()}
                className="btn btn--solid btn--sm"
              >
                {isSavingEdit ? 'Menyimpan...' : 'Simpan perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
