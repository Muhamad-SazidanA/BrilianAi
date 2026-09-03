'use client';

import React, { useState, useEffect } from 'react';

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

  // Edit Modal State (HANYA untuk Insight Kurasi sesuai instruksi pengguna)
  const [editingInsight, setEditingInsight] = useState<CuratedInsightItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [editImportance, setEditImportance] = useState<'high' | 'medium' | 'low'>('medium');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editTagsString, setEditTagsString] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

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

  // Open Edit Modal for Curated Insight
  const openEditModal = (insight: CuratedInsightItem) => {
    setEditingInsight(insight);
    setEditTitle(insight.title);
    setEditContent(insight.content);
    setEditImportance(insight.importance);
    setEditCategory(insight.category || 'track1_financial');
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

  // Pagination State (Options: 10, 20, 50, 100, 'all', Default: 10)
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [rawPage, setRawPage] = useState<number>(1);
  const [curatedPage, setCuratedPage] = useState<number>(1);

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

  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (p: number) => void
  ) => {
    const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? totalItems : pageSize) + 1;
    const endIdx = pageSize === 'all' ? totalItems : Math.min(currentPage * pageSize, totalItems);

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
          marginTop: '1.25rem',
          padding: '0.75rem 1.1rem',
          borderRadius: '10px',
          background: '#0d1322',
          border: '1px solid #1e293b',
        }}
      >
        {/* Info & Page Size Options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Menampilkan <strong style={{ color: '#fff' }}>{startIdx}-{endIdx}</strong> dari <strong style={{ color: '#fff' }}>{totalItems}</strong>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Limit:</span>
            {([10, 20, 50, 100, 'all'] as const).map((size) => {
              const isSelected = pageSize === size;
              return (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setRawPage(1);
                    setCuratedPage(1);
                  }}
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '5px',
                    border: isSelected ? '1px solid #6366f1' : '1px solid #1e293b',
                    background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    color: isSelected ? '#a5b4fc' : '#94a3b8',
                    fontSize: '0.72rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation Buttons */}
        {pageSize !== 'all' && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                background: '#131b2e',
                color: currentPage === 1 ? '#475569' : '#cbd5e1',
                fontSize: '0.72rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ⏮
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                background: '#131b2e',
                color: currentPage === 1 ? '#475569' : '#cbd5e1',
                fontSize: '0.72rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ◀ Prev
            </button>

            <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.4rem' }}>
              Hal <strong style={{ color: '#fff' }}>{currentPage}</strong> / {totalPages}
            </span>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                background: '#131b2e',
                color: currentPage === totalPages ? '#475569' : '#cbd5e1',
                fontSize: '0.72rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next ▶
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                background: '#131b2e',
                color: currentPage === totalPages ? '#475569' : '#cbd5e1',
                fontSize: '0.72rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              ⏭
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        borderRadius: '14px',
        border: '1px solid #1e293b',
        background: '#090d16',
        color: '#f8fafc',
        padding: '1.5rem',
        boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
        marginTop: '1.5rem',
        fontFamily: 'inherit',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.25rem', color: '#f43f5e' }}>💬</span>
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: '#f8fafc',
              margin: 0,
            }}
          >
            REPRESENTASI PENGETAHUAN
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            {totalChunksCount} chunks
          </span>

          <a
            href={`/api/documents/${batchId}/export`}
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '7px',
              border: '1px solid #2563eb',
              background: '#1e3a8a22',
              color: '#60a5fa',
              fontSize: '0.78rem',
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            📥 Export
          </a>

          <button
            onClick={() => alert('Fitur impor representasi data siap dikonfigurasi.')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '7px',
              border: '1px solid #059669',
              background: '#064e3b22',
              color: '#34d399',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📤 Import
          </button>

          {rawChunks.length > 0 && (
            <button
              onClick={handleRunAiCuration}
              disabled={isCurating}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.95rem',
                borderRadius: '7px',
                border: '1px solid #a855f7',
                background: isCurating ? '#581c87' : 'linear-gradient(135deg, #7e22ce, #9333ea)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: isCurating ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)',
              }}
            >
              {isCurating
                ? '⏳ Mengurasi (+25 Chunks)...'
                : curatedInsights.length === 0
                ? '✨ Jalankan Kurasi AI (+25 Chunks)'
                : '✨ Kurasi Lagi (+25 Chunks)'}
            </button>
          )}
        </div>
      </div>

      {curationError && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.8rem',
          }}
        >
          ⚠️ {curationError}
        </div>
      )}

      {/* Segmented Tab Pills (Insight kurasi vs Konten mentah) */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <button
          onClick={() => setActiveTab('curated')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: activeTab === 'curated' ? '1px solid #38bdf8' : '1px solid #1e293b',
            background: activeTab === 'curated' ? '#1e293b' : 'transparent',
            color: activeTab === 'curated' ? '#38bdf8' : '#64748b',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📌</span>
          <span>Insight kurasi ({curatedInsights.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
            border: activeTab === 'raw' ? '1px solid #38bdf8' : '1px solid #1e293b',
            background: activeTab === 'raw' ? '#1e293b' : 'transparent',
            color: activeTab === 'raw' ? '#38bdf8' : '#64748b',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📄</span>
          <span>Konten mentah ({rawChunks.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari dalam chunks..."
          style={{
            width: '100%',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            background: '#0b1120',
            border: '1px solid #1e293b',
            color: '#f8fafc',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
      </div>

      {/* TAB 1: KONTEN MENTAH (Images 1: Read-Only, diambil langsung dari halaman-halaman) */}
      {activeTab === 'raw' && (
        <div>
          {filteredRaw.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              Tidak ada konten mentah yang cocok dengan pencarian.
            </div>
          ) : (
            <>
              {renderPaginationControls(rawPage, rawTotalPages, rawTotal, setRawPage)}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
                  gap: '1rem',
                  marginTop: '1rem',
                }}
              >
                {paginatedRaw.map((chunk) => {
                  const pageLabel =
                    chunk.source_page_start === chunk.source_page_end
                      ? `Halaman ${chunk.source_page_start}`
                      : `Halaman ${chunk.source_page_start}-${chunk.source_page_end}`;

                  return (
                    <div
                      key={chunk.id}
                      style={{
                        borderRadius: '10px',
                        border: '1px solid #1e293b',
                        background: '#0d1322',
                        padding: '1.1rem 1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {/* Top Row: Page Title + Mentah & Low Badges */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.75rem',
                          }}
                        >
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '0.92rem',
                              fontWeight: 700,
                              color: '#f8fafc',
                            }}
                          >
                            {pageLabel}
                          </h4>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#94a3b8',
                                fontWeight: 600,
                              }}
                            >
                              mentah
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: '#27272a',
                                border: '1px solid #3f3f46',
                                color: '#a1a1aa',
                                fontWeight: 600,
                              }}
                            >
                              low
                            </span>
                          </div>
                        </div>

                        {/* Content Preview */}
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            color: '#cbd5e1',
                            lineHeight: '1.55',
                            maxHeight: '180px',
                            overflowY: 'auto',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {chunk.content}
                        </p>
                      </div>

                      {/* Bottom Row: Raw Tag */}
                      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #172033' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.18rem 0.5rem',
                            borderRadius: '4px',
                            background: '#1e3a8a33',
                            border: '1px solid #2563eb66',
                            color: '#60a5fa',
                            fontWeight: 700,
                          }}
                        >
                          raw
                        </span>
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

      {/* TAB 2: INSIGHT KURASI (Images 2: Curated, structured data with titles, importance, category, tags, editable) */}
      {activeTab === 'curated' && (
        <div>
          {curatedInsights.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1rem',
                border: '1px dashed #1e293b',
                borderRadius: '10px',
                color: '#94a3b8',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✨</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
                Belum Ada Insight Kurasi
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '460px', margin: '0 auto 1.25rem' }}>
                Jalankan kurasi AI untuk mengubah teks mentah menjadi data valid, memperbaiki tata bahasa,
                menentukan prioritas, dan mengekstrak tabel secara otomatis.
              </p>
              <button
                onClick={handleRunAiCuration}
                disabled={isCurating || rawChunks.length === 0}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: isCurating || rawChunks.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isCurating ? '⏳ Sedang Mengurasi 25 Chunks Pertama...' : '🚀 Mulai Kurasi AI (25 Chunk Pertama)'}
              </button>
            </div>
          ) : filteredCurated.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              Tidak ada insight kurasi yang cocok dengan pencarian.
            </div>
          ) : (
            <>
              {renderPaginationControls(curatedPage, curatedTotalPages, curatedTotal, setCuratedPage)}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
                  gap: '1rem',
                  marginTop: '1rem',
                }}
              >
                {paginatedCurated.map((item) => {
                  const importanceBadgeStyle =
                    item.importance === 'high'
                      ? { bg: '#7f1d1d44', border: '#ef444466', text: '#f87171' }
                      : item.importance === 'medium'
                      ? { bg: '#78350f44', border: '#f59e0b66', text: '#fbbf24' }
                      : { bg: '#1e293b', border: '#334155', text: '#94a3b8' };

                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: '10px',
                        border: '1px solid #1e293b',
                        background: '#0d1322',
                        padding: '1.1rem 1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div>
                        {/* Top Row: Title + Importance Badge + Edit Icon ✏️ */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            marginBottom: '0.75rem',
                          }}
                        >
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              color: '#f8fafc',
                              lineHeight: '1.4',
                            }}
                          >
                            {item.title}
                          </h4>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: importanceBadgeStyle.bg,
                                border: `1px solid ${importanceBadgeStyle.border}`,
                                color: importanceBadgeStyle.text,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                              }}
                            >
                              {item.importance}
                            </span>

                            {/* Tombol Edit ✏️ (HANYA untuk Insight Kurasi sesuai instruksi pengguna) */}
                            <button
                              onClick={() => openEditModal(item)}
                              title="Edit Insight Kurasi ini"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.25rem 0.45rem',
                                borderRadius: '5px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#f8fafc',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              ✏️
                            </button>
                          </div>
                        </div>

                        {/* Middle Row: Content with clean styling */}
                        <div
                          style={{
                            margin: 0,
                            fontSize: '0.82rem',
                            color: '#cbd5e1',
                            lineHeight: '1.6',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {item.content}
                        </div>
                      </div>

                      {/* Bottom Row: Collection Badge + AI Source + Tags */}
                      <div
                        style={{
                          marginTop: '1.25rem',
                          paddingTop: '0.85rem',
                          borderTop: '1px solid #172033',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Collection Category Badge (e.g., [📁 track1_financial]) */}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.18rem 0.5rem',
                            borderRadius: '4px',
                            background: '#1e3a8a33',
                            border: '1px solid #2563eb66',
                            color: '#60a5fa',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          📁 {item.category || 'track1_financial'}
                        </span>

                        {/* AI Source Badge (e.g., [🤖 AI]) */}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.18rem 0.45rem',
                            borderRadius: '4px',
                            background: '#064e3b33',
                            border: '1px solid #05966966',
                            color: '#34d399',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          🤖 AI
                        </span>

                        {/* Topic Tags */}
                        {Array.isArray(item.tags) &&
                          item.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#cbd5e1',
                                fontWeight: 500,
                              }}
                            >
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

      {/* MODAL EDIT INSIGHT KURASI (Hanya untuk Insight Kurasi) */}
      {editingInsight && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              borderRadius: '12px',
              border: '1px solid #334155',
              background: '#0f172a',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                ✏️ Edit Insight Kurasi
              </h3>
              <button
                onClick={() => setEditingInsight(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Judul Insight:
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: '#0b1120',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Tingkat Kepentingan:
                  </label>
                  <select
                    value={editImportance}
                    onChange={(e) => setEditImportance(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      background: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="high">high (Tinggi/Kritis)</option>
                    <option value="medium">medium (Sedang)</option>
                    <option value="low">low (Rendah/Umum)</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Kategori / Koleksi:
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      background: '#0b1120',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Tags (Pisahkan dengan koma):
                </label>
                <input
                  type="text"
                  value={editTagsString}
                  onChange={(e) => setEditTagsString(e.target.value)}
                  placeholder="Contoh: CSR, Dana Hibah, Keuangan"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: '#0b1120',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Isi Konten Kurasi:
                </label>
                <textarea
                  rows={5}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: '#0b1120',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                onClick={() => setEditingInsight(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  background: 'var(--accent-primary, #6366f1)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
