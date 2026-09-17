'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { UploadCloud, MessageSquare } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import DocumentTable from '@/components/documents/DocumentTable';
import DocumentStatsCards from '@/components/documents/DocumentStatsCards';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

export default function DocumentsPage() {
  const { language, t } = useLanguage();
  const { hasPermission } = useUserSession();
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDoc, setDeletingDoc] = useState<{ id: string; filename: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data: UploadBatch[] = await res.json();
        setBatches(data);
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
        success: language === 'en' ? 'Document renamed successfully' : 'Nama dokumen berhasil diperbarui',
        error: (err) => err.message,
      }
    );
  };

  const handleToggleActive = async (batchId: string, active: boolean) => {
    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActiveKnowledge: active }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || (language === 'en' ? 'Failed to change status' : 'Gagal mengubah status basis pengetahuan'));
        }
        await fetchBatches();
      },
      {
        loading: language === 'en' ? 'Updating status...' : 'Memperbarui status...',
        success: active
          ? (language === 'en' ? 'Document activated for AI knowledge base' : 'Dokumen diaktifkan ke basis pengetahuan AI')
          : (language === 'en' ? 'Document set to standby' : 'Dokumen diset ke standby'),
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

  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const filteredBatches = useMemo(() => {
    if (!selectedFilter || selectedFilter === 'total') return batches;
    if (selectedFilter === 'published') {
      return batches.filter((b) => b.is_active_knowledge !== false);
    }
    if (selectedFilter === 'active') {
      return batches.filter((b) => !!b.is_active_knowledge);
    }
    if (selectedFilter === 'inactive') {
      return batches.filter((b) => b.is_active_knowledge === false);
    }
    return batches;
  }, [batches, selectedFilter]);

  return (
    <AppShell
      requiredPermission="documents:read"
      title={t('docs.title')}
      subtitle={t('docs.subtitle')}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasPermission('documents:upload') && (
            <Link href="/upload" className="btn btn-primary btn-sm">
              <UploadCloud size={15} />
              <span>{t('dash.upload_new')}</span>
            </Link>
          )}
          {hasPermission('chat:query') && (
            <Link href="/chat" className="btn btn-outline btn-sm">
              <MessageSquare size={15} />
              <span>Tanya Dokumen</span>
            </Link>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Document Stats Cards */}
        <DocumentStatsCards
          batches={batches}
          activeFilter={selectedFilter}
          onSelectFilter={setSelectedFilter}
        />

        {/* Document Table */}
        <DocumentTable
          batches={filteredBatches}
          isLoading={isLoading}
          onRefresh={fetchBatches}
          onDelete={handleDelete}
          onRename={handleRename}
          onToggleActive={handleToggleActive}
          onActivateAll={handleActivateAll}
        />
      </div>

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
