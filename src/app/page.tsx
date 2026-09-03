'use client';

import React, { useState, useEffect, useRef } from 'react';
import KnowledgeRepresentation, { CuratedInsightItem } from '@/components/KnowledgeRepresentation';

interface UploadBatch {
  id: string;
  original_filename: string;
  chunk_count: number;
  page_count: number;
  uploaded_at: string;
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

export default function DashboardPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IngestionResult | null>(null);

  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);

  // Inspector state
  const [activeBatch, setActiveBatch] = useState<UploadBatch | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [curatedInsights, setCuratedInsights] = useState<CuratedInsightItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState<boolean>(false);
  const [chunkSearchQuery, setChunkSearchQuery] = useState<string>('');
  const [copiedChunkId, setCopiedChunkId] = useState<string | number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load batches on mount
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

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

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadStep('Mengunggah & merender halaman PDF via AI Vision...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simulate status message progress updates for good UX
      const statusTimer1 = setTimeout(() => {
        setUploadStep('AI Vision (Qwen 2.5 VL) mengekstrak teks tiap halaman...');
      }, 3500);

      const statusTimer2 = setTimeout(() => {
        setUploadStep('Memotong chunks (Sliding Window) & Embedding 1024-dim (BGE-M3)...');
      }, 7000);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(statusTimer1);
      clearTimeout(statusTimer2);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses dokumen PDF');
      }

      setLastResult(data);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Refresh documents list
      await fetchBatches();

      // Automatically inspect the newly uploaded batch
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
    setChunkSearchQuery('');

    try {
      const [chunksRes, curatedRes] = await Promise.all([
        fetch(`/api/documents/${batch.id}/chunks`),
        fetch(`/api/documents/${batch.id}/curate`),
      ]);

      if (chunksRes.ok) {
        const data: DocumentChunk[] = await chunksRes.json();
        setChunks(data);
      }

      if (curatedRes.ok) {
        const data: CuratedInsightItem[] = await curatedRes.json();
        setCuratedInsights(data);
      }
    } catch (err) {
      console.error('Gagal mengambil data batch:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const filteredChunks = chunks.filter((c) =>
    c.content.toLowerCase().includes(chunkSearchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(10, 13, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
              fontWeight: 800,
              fontSize: '1.25rem',
              color: '#fff',
            }}
          >
            B
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
              BrilianAI <span style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 500 }}>Vision Ingestion</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              In-Memory PDF Vision OCR + Sliding Window + pgvector
            </p>
          </div>
        </div>

        {/* Tech Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: '#a5b4fc',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }} />
            Qwen 2.5 VL (Vision)
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              color: '#67e8f9',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06b6d4' }} />
            BGE-M3 (1024d)
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            pgvector Active
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Left Column: Upload Area & Pipeline Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Upload Card */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
                  Upload Dokumen PDF
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Setiap halaman akan dirender ke gambar dan dipindai secara utuh oleh AI Vision.
                </p>
              </div>

              {/* Drag & Drop Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'var(--border-glow)'}`,
                  backgroundColor: isDragging ? 'rgba(6, 182, 212, 0.08)' : 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '12px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  style={{ display: 'none' }}
                />

                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                  📄
                </div>

                {selectedFile ? (
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.95rem', wordBreak: 'break-all' }}>
                      {selectedFile.name}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Klik untuk ganti file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      Tarik & lepas file PDF di sini
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      atau klik untuk memilih dari perangkat Anda
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {uploadError && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#fca5a5',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚠️ {uploadError}
                </div>
              )}

              {/* Submit Button & Progress */}
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  disabled={!selectedFile || isUploading}
                  onClick={handleUploadSubmit}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1.5rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: selectedFile && !isUploading ? 'var(--gradient-brand)' : 'var(--bg-tertiary)',
                    color: selectedFile && !isUploading ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: selectedFile && !isUploading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: selectedFile && !isUploading ? '0 4px 20px rgba(99, 102, 241, 0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isUploading ? (
                    <>
                      <div
                        className="spinner"
                        style={{
                          width: '18px',
                          height: '18px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                        }}
                      />
                      <span>Memproses Ingestion...</span>
                    </>
                  ) : (
                    <span>🚀 Jalankan Ingestion AI Vision</span>
                  )}
                </button>
              </div>

              {/* Live Processing Indicator */}
              {isUploading && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="pulse-animation" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c7d2fe' }}>
                      Status Eksekusi Pipeline:
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {uploadStep}
                  </p>
                </div>
              )}
            </div>

            {/* Architecture Info Box */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                ⚙️ Prinsip Pipeline Ingestion
              </h3>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '1.2rem' }}>
                <li><strong>100% In-Memory:</strong> File PDF & gambar tidak disimpan di disk.</li>
                <li><strong>Ollama Vision OCR:</strong> Menggunakan <code>qwen2.5vl:7b</code> untuk ekstraksi teks layout akurat.</li>
                <li><strong>Sliding Window:</strong> Chunking (800 chars, 150 overlap) dengan pelacakan rentang halaman awal/akhir.</li>
                <li><strong>Dense Embedding:</strong> <code>bge-m3</code> menghasilkan vector 1024-dimensi ke PostgreSQL pgvector.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Ingestion Results / Document Explorer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Last Result Notification Banner */}
            {lastResult && (
              <div
                className="glass-panel"
                style={{
                  padding: '1.25rem 1.5rem',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                      Ingestion Berhasil: {lastResult.original_filename}
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Berhasil mengekstrak <strong>{lastResult.page_count} Halaman</strong> menjadi <strong>{lastResult.chunk_count} Chunks</strong> dengan embedding pgvector.
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
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--accent-emerald)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Lihat Chunks
                </button>
              </div>
            )}

            {/* Document Batches List */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                    Daftar Dokumen Tersimpan ({batches.length})
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Data batch yang sudah tersimpan di database PostgreSQL & pgvector.
                  </p>
                </div>
                <button
                  onClick={fetchBatches}
                  disabled={isLoadingBatches}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  🔄 Refresh
                </button>
              </div>

              {isLoadingBatches ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Memuat daftar dokumen...
                </div>
              ) : batches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Belum ada dokumen yang di-upload</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Unggah file PDF pertama Anda di panel sebelah kiri untuk memulai.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                  {batches.map((batch) => {
                    const isSelected = activeBatch?.id === batch.id;
                    const dateFormatted = new Date(batch.uploaded_at).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });

                    return (
                      <div
                        key={batch.id}
                        onClick={() => inspectBatch(batch)}
                        style={{
                          padding: '1rem 1.25rem',
                          borderRadius: '10px',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(15, 23, 42, 0.4)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ minWidth: 0, paddingRight: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>📑</span>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                              {batch.original_filename}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Diunggah: {dateFormatted} • ID: <code style={{ fontSize: '0.7rem' }}>{batch.id.substring(0, 8)}...</code>
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              background: 'rgba(6, 182, 212, 0.12)',
                              color: 'var(--accent-cyan)',
                              border: '1px solid rgba(6, 182, 212, 0.25)',
                              fontWeight: 600,
                            }}
                          >
                            {batch.page_count} Hal
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#a5b4fc',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              fontWeight: 600,
                            }}
                          >
                            {batch.chunk_count} Chunks
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Knowledge Representation Section (Dual-Chunk: Mentah & Insight Kurasi) */}
            {activeBatch && (
              <KnowledgeRepresentation
                batchId={activeBatch.id}
                filename={activeBatch.original_filename}
                rawChunks={chunks}
                curatedInsights={curatedInsights}
                onRefreshCurated={() => fetchCuratedInsights(activeBatch.id)}
              />
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
