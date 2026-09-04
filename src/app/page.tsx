'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  RefreshCw,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import KnowledgeRepresentation, { CuratedInsightItem } from '@/components/KnowledgeRepresentation';
import ChatbotWidget from '@/components/ChatbotWidget';

/* ── Types ──────────────────────────────────────────────── */
interface UploadBatch {
  id: string;
  original_filename: string;
  chunk_count: number;
  page_count: number;
  uploaded_at: string;
  is_active_knowledge?: boolean;
}

interface DocumentChunk {
  id: number | string;
  upload_batch_id: string;
  chunk_index: number;
  content: string;
  source_page_start: number;
  source_page_end: number;
  embedding?: string | number[];
  created_at: string;
}

interface IngestionResult {
  upload_batch_id: string;
  original_filename: string;
  page_count: number;
  chunk_count: number;
}

/* ── Pipeline steps data ──────────────────────────────────── */
const PIPELINE_STEPS = [
  {
    number: '1',
    title: 'In-memory render',
    description: 'PDF → gambar, tanpa simpan ke disk',
  },
  {
    number: '2',
    title: 'Vision OCR',
    description: 'Qwen 2.5 VL ekstrak teks tiap halaman',
  },
  {
    number: '3',
    title: 'Sliding window',
    description: 'Chunking 800 karakter, overlap 150',
  },
  {
    number: '4',
    title: 'Dense embedding',
    description: 'BGE-M3 → vector 1024-dim ke pgvector',
  },
];

/* ═══════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IngestionResult | null>(null);

  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);

  // Document CRUD state
  const [editingBatch, setEditingBatch] = useState<UploadBatch | null>(null);
  const [newBatchName, setNewBatchName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Inspector state
  const [activeBatch, setActiveBatch] = useState<UploadBatch | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [curatedInsights, setCuratedInsights] = useState<CuratedInsightItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Data fetching ──────────────────────────────────────────
  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data: UploadBatch[] = await res.json();
        setBatches(data);
      }
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // ── Document CRUD ─────────────────────────────────────────
  const handleDeleteBatch = async (batchId: string, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Hapus dokumen "${filename}" beserta seluruh chunks dan insight-nya?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${batchId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus dokumen');
      }
      if (activeBatch?.id === batchId) {
        setActiveBatch(null);
        setChunks([]);
        setCuratedInsights([]);
      }
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus dokumen');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenRename = (batch: UploadBatch, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBatch(batch);
    setNewBatchName(batch.original_filename);
  };

  const handleSaveRename = async () => {
    if (!editingBatch || !newBatchName.trim()) return;
    try {
      const res = await fetch(`/api/documents/${editingBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newBatchName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengubah nama dokumen');
      }
      if (activeBatch?.id === editingBatch.id) {
        setActiveBatch((prev) => (prev ? { ...prev, original_filename: newBatchName.trim() } : null));
      }
      setEditingBatch(null);
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah nama dokumen');
    }
  };

  const handleToggleKnowledgeBase = async (batchId: string, active: boolean) => {
    try {
      const res = await fetch(`/api/documents/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActiveKnowledge: active }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah status basis pengetahuan');
      }
      setActiveBatch((prev) => (prev && prev.id === batchId ? { ...prev, is_active_knowledge: active } : prev));
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat mengubah status basis pengetahuan');
    }
  };

  // ── Drag & Drop ───────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Hanya file PDF yang didukung (.pdf)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError('Hanya file PDF yang didukung (.pdf)');
        return;
      }
      setSelectedFile(file);
    }
  };

  // ── Upload submit ─────────────────────────────────────────
  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadStep('Mengunggah & merender halaman PDF via AI Vision...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const t1 = setTimeout(() => setUploadStep('AI Vision (Qwen 2.5 VL) mengekstrak teks tiap halaman...'), 3500);
      const t2 = setTimeout(() => setUploadStep('Memotong chunks (Sliding Window) & Embedding 1024-dim (BGE-M3)...'), 7000);

      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      clearTimeout(t1);
      clearTimeout(t2);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses dokumen PDF');

      setLastResult(data);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchBatches();
      inspectBatch({
        id: data.upload_batch_id,
        original_filename: data.original_filename,
        chunk_count: data.chunk_count,
        page_count: data.page_count,
        uploaded_at: new Date().toISOString(),
      });
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat memproses file');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  // ── Curated insights ──────────────────────────────────────
  const fetchCuratedInsights = async (batchId: string) => {
    try {
      const res = await fetch(`/api/documents/${batchId}/curate`);
      if (res.ok) {
        const data: CuratedInsightItem[] = await res.json();
        setCuratedInsights(data);
      }
    } catch (err) {
      console.error('Gagal mengambil insight kurasi:', err);
    }
  };

  const inspectBatch = async (batch: UploadBatch) => {
    setActiveBatch(batch);
    setIsLoadingChunks(true);
    setChunks([]);
    setCuratedInsights([]);

    try {
      const [chunksRes, curatedRes] = await Promise.all([
        fetch(`/api/documents/${batch.id}/chunks`),
        fetch(`/api/documents/${batch.id}/curate`),
      ]);
      if (chunksRes.ok) setChunks(await chunksRes.json());
      if (curatedRes.ok) setCuratedInsights(await curatedRes.json());
    } catch (err) {
      console.error('Gagal mengambil data batch:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-paper)' }}>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: '1px solid var(--color-hairline)',
          padding: '0 2rem',
          height: '60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--color-paper)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
              color: '#fff',
              flexShrink: 0,
              letterSpacing: '-0.02em',
            }}
          >
            B
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.01em', lineHeight: '20px' }}>
              BrilianAI
            </div>
            <div className="type-data" style={{ fontSize: '12px', lineHeight: '16px' }}>
              Vision Ingestion · pgvector RAG
            </div>
          </div>
        </div>

      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          padding: '2rem',
          maxWidth: '1440px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div
          className="grid-2col"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 440px) 1fr',
            gap: '2rem',
            alignItems: 'start',
          }}
        >
          {/* ══════════════════════════════════
              Left Column
              ══════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ── Upload card ───────────────── */}
            <section
              style={{
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                backgroundColor: 'var(--color-paper)',
              }}
            >
              <h2 className="type-section-title" style={{ marginBottom: '4px' }}>
                Upload dokumen PDF
              </h2>
              <p className="type-meta" style={{ marginBottom: '1.25rem' }}>
                Setiap halaman dirender ke gambar dan dipindai oleh AI Vision.
              </p>

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1px dashed ${isDragging ? 'var(--color-accent)' : 'var(--color-hairline)'}`,
                  backgroundColor: isDragging ? 'rgba(47, 93, 255, 0.04)' : 'var(--color-mist)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background-color 0.15s',
                  userSelect: 'none',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  style={{ display: 'none' }}
                />
                <UploadCloud
                  size={28}
                  strokeWidth={1.5}
                  color="var(--color-slate)"
                  style={{ margin: '0 auto 10px' }}
                />
                {selectedFile ? (
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--color-accent)', fontSize: '14px', wordBreak: 'break-all', lineHeight: '20px' }}>
                      {selectedFile.name}
                    </p>
                    <p className="type-meta" style={{ marginTop: '4px' }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Klik untuk ganti file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="type-body" style={{ fontWeight: 600 }}>Tarik & lepas file PDF di sini</p>
                    <p className="type-meta" style={{ marginTop: '4px' }}>
                      atau klik untuk memilih dari perangkat Anda
                    </p>
                  </div>
                )}
              </div>

              {/* Error */}
              {uploadError && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(214, 69, 69, 0.06)',
                    border: '1px solid rgba(214, 69, 69, 0.2)',
                    color: 'var(--color-danger)',
                    fontSize: '13px',
                    lineHeight: '18px',
                  }}
                >
                  {uploadError}
                </div>
              )}

              {/* Submit button */}
              <div style={{ marginTop: '14px' }}>
                <button
                  disabled={!selectedFile || isUploading}
                  onClick={handleUploadSubmit}
                  className="btn btn--solid"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '10px 16px',
                    fontSize: '14px',
                    opacity: !selectedFile || isUploading ? 0.45 : 1,
                    cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isUploading ? (
                    <>
                      <div
                        className="spinner"
                        style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          flexShrink: 0,
                        }}
                      />
                      Memproses ingestion...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} strokeWidth={2} />
                      Jalankan ingestion AI Vision
                    </>
                  )}
                </button>
              </div>

              {/* Live processing status */}
              {isUploading && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-mist)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-accent)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink)' }}>
                      Status eksekusi pipeline
                    </span>
                  </div>
                  <p className="type-meta" style={{ paddingLeft: '15px' }}>{uploadStep}</p>
                </div>
              )}
            </section>

            {/* ── Pipeline steps ────────────── */}
            <section
              style={{
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                backgroundColor: 'var(--color-paper)',
              }}
            >
              <h2 className="type-section-title" style={{ marginBottom: '1.25rem' }}>
                Prinsip pipeline ingestion
              </h2>
              <div
                className="pipeline-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  position: 'relative',
                }}
              >
                {/* Connector line */}
                <div
                  style={{
                    position: 'absolute',
                    top: '11px',
                    left: '12%',
                    right: '12%',
                    height: '1px',
                    backgroundColor: 'var(--color-hairline)',
                    zIndex: 0,
                  }}
                />
                {PIPELINE_STEPS.map((step) => (
                  <div key={step.number} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1, gap: '8px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '1px solid var(--color-hairline)',
                        backgroundColor: 'var(--color-paper)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--color-slate)',
                        flexShrink: 0,
                      }}
                    >
                      {step.number}
                    </div>
                    <div>
                      <div className="type-card-title" style={{ fontSize: '12px', lineHeight: '16px', textAlign: 'center' }}>
                        {step.title}
                      </div>
                      <div className="type-meta" style={{ fontSize: '11px', lineHeight: '16px', marginTop: '2px', textAlign: 'center' }}>
                        {step.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ══════════════════════════════════
              Right Column
              ══════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ── Success notification ──────── */}
            {lastResult && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-paper)',
                }}
              >
                <CheckCircle2 size={18} strokeWidth={1.5} color="var(--color-success)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-ink)' }}>
                    Ingestion berhasil: {lastResult.original_filename}
                  </span>
                  <p className="type-meta" style={{ marginTop: '2px' }}>
                    Berhasil mengekstrak{' '}
                    <span className="type-data">{lastResult.page_count} halaman</span> menjadi{' '}
                    <span className="type-data">{lastResult.chunk_count} chunks</span> dengan embedding pgvector.
                  </p>
                </div>
                <button
                  onClick={() => inspectBatch({
                    id: lastResult.upload_batch_id,
                    original_filename: lastResult.original_filename,
                    chunk_count: lastResult.chunk_count,
                    page_count: lastResult.page_count,
                    uploaded_at: new Date().toISOString(),
                  })}
                  className="btn btn--outline btn--sm"
                  style={{ flexShrink: 0 }}
                >
                  Lihat chunks
                </button>
              </div>
            )}

            {/* ── Document list ─────────────── */}
            <section
              style={{
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '1.5rem',
                backgroundColor: 'var(--color-paper)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h2 className="type-section-title">
                    Dokumen tersimpan
                    <span className="type-data" style={{ fontWeight: 400, marginLeft: '8px', fontSize: '14px' }}>
                      ({batches.length})
                    </span>
                  </h2>
                  <p className="type-meta" style={{ marginTop: '2px' }}>
                    Data batch tersimpan di PostgreSQL &amp; pgvector.
                  </p>
                </div>
                <button
                  onClick={fetchBatches}
                  disabled={isLoadingBatches}
                  className="btn btn--outline btn--sm"
                  aria-label="Refresh daftar dokumen"
                >
                  <RefreshCw
                    size={14}
                    strokeWidth={2}
                    className={isLoadingBatches ? 'spinner' : ''}
                  />
                  Refresh
                </button>
              </div>

              {/* Body */}
              {isLoadingBatches ? (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <div
                    className="spinner"
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid var(--color-hairline)',
                      borderTopColor: 'var(--color-accent)',
                      borderRadius: '50%',
                      margin: '0 auto 12px',
                    }}
                  />
                  <p className="type-meta">Memuat daftar dokumen...</p>
                </div>
              ) : batches.length === 0 ? (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <FileText size={32} strokeWidth={1} color="var(--color-hairline)" style={{ margin: '0 auto 12px' }} />
                  <p className="type-body" style={{ fontWeight: 600 }}>Belum ada dokumen yang di-upload</p>
                  <p className="type-meta" style={{ marginTop: '4px' }}>
                    Unggah file PDF pertama Anda di panel sebelah kiri untuk memulai.
                  </p>
                </div>
              ) : (
                <div style={{ maxHeight: '480px', overflowY: 'auto', marginRight: '-4px', paddingRight: '4px' }}>
                  {batches.map((batch) => {
                    const isActive = activeBatch?.id === batch.id;
                    const dateFormatted = new Date(batch.uploaded_at).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });

                    return (
                      <div
                        key={batch.id}
                        onClick={() => inspectBatch(batch)}
                        className={`doc-row${isActive ? ' doc-row--active' : ''}`}
                      >
                        {/* Left: name + meta */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
                          <FileText
                            size={18}
                            strokeWidth={1.5}
                            color={isActive ? 'var(--color-accent)' : 'var(--color-slate)'}
                            style={{ flexShrink: 0, marginTop: '1px' }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div className="type-card-title" style={{ wordBreak: 'break-all' }}>
                              {batch.original_filename}
                            </div>
                            <div className="type-data" style={{ marginTop: '2px', fontSize: '12px' }}>
                              {dateFormatted} &nbsp;·&nbsp; ID:&nbsp;{batch.id.substring(0, 8)}…
                            </div>
                          </div>
                        </div>

                        {/* Right: chips + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span className="stat-chip">{batch.page_count} hal</span>
                          <span className="stat-chip">{batch.chunk_count} chunks</span>
                          {batch.is_active_knowledge && (
                            <span
                              className="stat-chip"
                              style={{
                                color: '#16a34a',
                                borderColor: 'rgba(34, 197, 94, 0.4)',
                                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                                fontWeight: 600,
                              }}
                            >
                              AI Aktif
                            </span>
                          )}

                          <div className="doc-row-actions">
                            <button
                              onClick={(e) => handleOpenRename(batch, e)}
                              className="btn btn--ghost btn--icon-sm"
                              aria-label="Ubah nama dokumen"
                              title="Ubah nama dokumen"
                            >
                              <Pencil size={14} strokeWidth={2} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteBatch(batch.id, batch.original_filename, e)}
                              disabled={isDeleting}
                              className="btn btn--ghost btn--ghost-danger btn--icon-sm"
                              aria-label="Hapus dokumen"
                              title="Hapus dokumen beserta seluruh chunks & insights"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Knowledge Representation ──── */}
            {activeBatch && (
              <KnowledgeRepresentation
                batchId={activeBatch.id}
                filename={activeBatch.original_filename}
                rawChunks={chunks}
                curatedInsights={curatedInsights}
                onRefreshCurated={() => fetchCuratedInsights(activeBatch.id)}
                isActiveKnowledge={activeBatch.is_active_knowledge}
                onToggleKnowledgeBase={(active) => handleToggleKnowledgeBase(activeBatch.id, active)}
              />
            )}
          </div>
        </div>
      </main>

      {/* ── Rename Modal ────────────────────────────────────── */}
      {editingBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 22, 27, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={() => setEditingBatch(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(20,22,27,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 className="type-card-title">Ubah nama dokumen</h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="btn btn--ghost btn--icon-sm"
                aria-label="Tutup modal"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <label className="type-meta" style={{ display: 'block', marginBottom: '6px' }}>
              Nama file baru
            </label>
            <input
              type="text"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); }}
              className="input-field"
              style={{ marginBottom: '1.25rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setEditingBatch(null)} className="btn btn--outline btn--sm">
                Batal
              </button>
              <button
                onClick={handleSaveRename}
                disabled={!newBatchName.trim()}
                className="btn btn--solid btn--sm"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Chatbot ────────────────────────────────── */}
      <ChatbotWidget
        documentId={activeBatch?.id}
        documentName={activeBatch?.original_filename}
        isActiveKnowledge={activeBatch?.is_active_knowledge}
      />
    </div>
  );
}
