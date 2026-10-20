'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import DocumentTable from '@/components/documents/DocumentTable';
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

    const handleCompleted = () => {
      fetchBatches();
    };

    window.addEventListener('document_ingestion_completed', handleCompleted);
    return () => {
      window.removeEventListener('document_ingestion_completed', handleCompleted);
    };
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

  const handleToggleActive = async (batchId: string, targetActive: boolean) => {
    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isActiveKnowledge: targetActive,
            is_active_knowledge: targetActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengubah status aktif dokumen');
        }
        await fetchBatches();
        return data;
      },
      {
        loading: language === 'en' ? 'Updating status...' : 'Memperbarui status...',
        success: (data) =>
          data?.message ||
          (targetActive
            ? (language === 'en' ? 'Document activated for AI Chatbot.' : 'Dokumen diaktifkan untuk AI Chatbot.')
            : (language === 'en' ? 'Document deactivated from AI Chatbot.' : 'Dokumen dinonaktifkan dari AI Chatbot.')),
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
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gagal mengaktifkan seluruh dokumen');
        }
        await fetchBatches();
        return data;
      },
      {
        loading: language === 'en' ? 'Activating curated documents...' : 'Mengaktifkan dokumen terkurasi...',
        success: (data) =>
          data?.message ||
          (language === 'en'
            ? 'All curated documents activated for AI Chatbot!'
            : 'Seluruh dokumen terkurasi berhasil diaktifkan untuk AI Chatbot!'),
        error: (err) => err.message,
      }
    );
  };

  return (
    <AppShell requiredPermission="documents:read">
      <div className="enterprise-page-container">
        {/* Document Table (Unified Spensify-style Stream Card) */}
        <DocumentTable
          batches={batches}
          isLoading={isLoading}
          onRefresh={fetchBatches}
          onDelete={handleDelete}
          onRename={handleRename}
          onToggleActive={handleToggleActive}
          onActivateAll={handleActivateAll}
          onUpload={() => setIsUploadOpen(true)}
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
