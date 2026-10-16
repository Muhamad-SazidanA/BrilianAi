'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UploadCloud } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EnterprisePageHeader from '@/components/layout/EnterprisePageHeader';
import DocumentTable from '@/components/documents/DocumentTable';
import DocumentStatsCards from '@/components/documents/DocumentStatsCards';
import DocumentUploadModal from '@/components/documents/DocumentUploadModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

function DocumentsContent() {
  const { language, t } = useLanguage();
  const { hasPermission } = useUserSession();
  const searchParams = useSearchParams();

  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncTime, setSyncTime] = useState<string>('');
  const [deletingDoc, setDeletingDoc] = useState<{ id: string; filename: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Dynamic sticky measurement for 4 stats cards
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsHeight, setStatsHeight] = useState(110);

  useEffect(() => {
    if (!statsRef.current) return;
    const updateHeight = () => {
      if (statsRef.current) {
        const h = Math.round(statsRef.current.getBoundingClientRect().height);
        if (h > 0) setStatsHeight(h);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(statsRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [batches]);

  useEffect(() => {
    if (searchParams.get('action') === 'upload') {
      setIsUploadOpen(true);
    }
  }, [searchParams]);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data: UploadBatch[] = await res.json();
        setBatches(data);
        const d = new Date();
        setSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.error('Gagal mengambil daftar dokumen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleDelete = async (batchId: string, filename: string) => {
    setDeletingDoc({ id: batchId, filename });
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deletingDoc.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || (language === 'en' ? 'Failed to delete document' : 'Gagal menghapus dokumen')
        );
      }
      const deletedName = deletingDoc.filename;
      setDeletingDoc(null);
      await fetchBatches();
      toast.success(
        language === 'en'
          ? `Document "${deletedName}" deleted successfully.`
          : `Dokumen "${deletedName}" berhasil dihapus.`
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus dokumen');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async (batchId: string, newFilename: string) => {
    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: newFilename }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || (language === 'en' ? 'Failed to rename document' : 'Gagal mengubah nama dokumen'));
        }
        await fetchBatches();
      },
      {
        loading: language === 'en' ? 'Saving new name...' : 'Menyimpan nama dokumen...',
        success: language === 'en' ? 'Document renamed successfully.' : 'Nama dokumen berhasil diperbarui.',
        error: (err) => err.message,
      }
    );
  };

  const handleToggleActive = async (batchId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active_knowledge: nextActive }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal mengubah status aktif dokumen');
        }
        await fetchBatches();
      },
      {
        loading: language === 'en' ? 'Updating status...' : 'Memperbarui status...',
        success: nextActive
          ? (language === 'en' ? 'Document activated for AI Chatbot.' : 'Dokumen diaktifkan untuk AI Chatbot.')
          : (language === 'en' ? 'Document deactivated from AI Chatbot.' : 'Dokumen dinonaktifkan dari AI Chatbot.'),
        error: (err) => err.message,
      }
    );
  };

  const handleActivateAll = async () => {
    toast.promise(
      async () => {
        const res = await fetch('/api/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activateAll: true }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal mengaktifkan seluruh dokumen');
        }
        await fetchBatches();
      },
      {
        loading: language === 'en' ? 'Activating all documents...' : 'Mengaktifkan seluruh dokumen...',
        success: language === 'en' ? 'All documents activated for AI Chatbot!' : 'Seluruh dokumen berhasil diaktifkan untuk AI Chatbot!',
        error: (err) => err.message,
      }
    );
  };

  return (
    <AppShell requiredPermission="documents:read">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '0 0.25rem 3.5rem',
        }}
      >
        {/* Enterprise Page Header */}
        <EnterprisePageHeader
          title={language === 'en' ? 'Knowledge Base' : 'Basis Pengetahuan'}
          subtitle={
            language === 'en'
              ? 'Vision OCR per page, document volume, and curated insights.'
              : 'Vision OCR per halaman, volume dokumen, dan kurasi analitik.'
          }
          syncTime={syncTime}
          onRefresh={fetchBatches}
          isLoading={isLoading}
          actions={
            hasPermission('documents:upload') ? (
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '28px',
                  padding: '0 12px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
                  backgroundColor: '#2563EB',
                  border: '1px solid #1D4ED8',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1D4ED8';
                  e.currentTarget.style.transform = 'translateY(-0.5px)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(37, 99, 235, 0.15)';
                }}
              >
                <UploadCloud size={12} strokeWidth={2.2} />
                <span>{language === 'en' ? 'Upload Document' : 'Unggah Dokumen'}</span>
              </button>
            ) : null
          }
        />

        {/* Document Stats Cards (Pure 4-card enterprise metrics) */}
        <DocumentStatsCards batches={batches} isLoading={isLoading} containerRef={statsRef} />

        {/* Document Table with High-Density Controls & Shimmer Skeleton */}
        <DocumentTable
          batches={batches}
          isLoading={isLoading}
          onRefresh={fetchBatches}
          onDelete={handleDelete}
          onRename={handleRename}
          onToggleActive={handleToggleActive}
          onActivateAll={handleActivateAll}
          onUpload={() => setIsUploadOpen(true)}
          stickyTop={48 + statsHeight - 1}
        />
      </div>

      {/* Clean & Slim Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          if (typeof window !== 'undefined' && window.location.search.includes('action=upload')) {
            window.history.replaceState({}, '', '/documents');
          }
        }}
        onSuccess={fetchBatches}
      />

      {/* Confirmation Modal for Document Deletion */}
      <ConfirmationModal
        isOpen={!!deletingDoc}
        onClose={() => {
          if (!isDeleting) setDeletingDoc(null);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={language === 'en' ? 'Delete Document?' : 'Hapus Dokumen?'}
        description={
          language === 'en' ? (
            <>
              Are you sure you want to delete <strong>&quot;{deletingDoc?.filename}&quot;</strong>? All raw chunks,
              curated insights, and vector embeddings for this file will be permanently removed from the database.
            </>
          ) : (
            <>
              Apakah Anda yakin ingin menghapus <strong>&quot;{deletingDoc?.filename}&quot;</strong>? Seluruh raw
              chunk, intisari kurasi, dan vektor dokumen ini akan dihapus permanen dari sistem.
            </>
          )
        }
        confirmLabel={language === 'en' ? 'Yes, Delete Document' : 'Ya, Hapus Dokumen'}
        cancelLabel={language === 'en' ? 'Cancel' : 'Batal'}
        variant="danger"
      />
    </AppShell>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Memuat Dokumen...</div>}>
      <DocumentsContent />
    </Suspense>
  );
}
