'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldCheck, Shield, Plus, Search, X, Lock, Loader2,
  Users, Trash2, Pencil, Eye, Copy, Check,
} from 'lucide-react';
import { Role, PermissionKey, PERMISSIONS_CATALOG, PermissionCategory } from '@/types/user';
import { DocumentClassification } from '@/types/document';
import EnterprisePagination from '@/components/ui/EnterprisePagination';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

export const ALL_CLASSIFICATIONS: {
  key: DocumentClassification;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { key: 'Publik', label: 'Publik', desc: 'Dapat membaca dokumen umum & materi terbuka', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'Internal', label: 'Internal', desc: 'Dokumen operasional internal standar', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'Rahasia', label: 'Rahasia', desc: 'Dokumen tim sensitif, manajerial & keuangan', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { key: 'Sangat Rahasia', label: 'Sangat Rahasia', desc: 'Dokumen strategis direksi & data rahasia tertinggi', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

/* ─── Category labels ─────────────────────────────── */
const CAT_LABELS: Record<PermissionCategory, string> = {
  dashboard: 'Akses Dasbor & Metrik',
  documents: 'Dokumen & Ingestion RAG',
  curation: 'Kurasi & Evaluasi AI',
  chat: 'Asisten AI & Percakapan',
  administration: 'Manajemen & Administrasi',
};
const ALL_CATS = Object.keys(CAT_LABELS) as PermissionCategory[];

/* ─── Shared modal styling ────────────────────────── */
const OL: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1.25rem',
};

const INP: React.CSSProperties = {
  width: '100%',
  height: '34px',
  padding: '0 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-default, #e2e8f0)',
  fontSize: '12.5px',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-card, #ffffff)',
  outline: 'none',
  boxSizing: 'border-box',
};

const LBL: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '5px',
};

function BOX(w = 520): React.CSSProperties {
  return {
    backgroundColor: 'var(--bg-card, #ffffff)',
    border: '1px solid var(--border-default, #e2e8f0)',
    borderRadius: '14px',
    width: '100%',
    maxWidth: `${w}px`,
    padding: '1.5rem',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16)',
  };
}

function IBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: '1px solid var(--border-default, #e2e8f0)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: danger ? '#dc2626' : 'var(--text-secondary)',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = danger ? '#fef2f2' : 'var(--bg-subtle, #f8fafc)';
        e.currentTarget.style.borderColor = danger ? '#fecaca' : 'var(--border-hover, #cbd5e1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
        e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '9999px',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        backgroundColor: checked ? 'var(--color-primary, #2563eb)' : '#cbd5e1',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export default function RolesPermissionsView() {
  const { language } = useLanguage();
  const { hasPermission, refreshUsers } = useUserSession();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncTime, setSyncTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K and /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* Editor modal */
  type EditorMode = 'create' | 'edit' | 'view';
  const [editor, setEditor] = useState<{ mode: EditorMode; role: Role | null } | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<PermissionKey[]>([]);
  const [selectedClassifications, setSelectedClassifications] = useState<DocumentClassification[]>(['Publik', 'Internal']);
  const [permSearch, setPermSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Delete confirm */
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const canManage = hasPermission('roles:manage');

  /* ── fetch ── */
  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/roles');
      if (res.ok) setRoles((await res.json()).roles || []);
      const d = new Date();
      setSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      toast.error('Gagal memuat role: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /* ── derived metrics ── */
  const systemRoles = useMemo(() => roles.filter((r) => r.is_system), [roles]);
  const customRoles = useMemo(() => roles.filter((r) => !r.is_system), [roles]);

  /* ── filter + paginate ── */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, page), totalPages);
  const paginated = useMemo(() => {
    const s = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(s, s + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  /* ── open editor ── */
  const openCreate = () => {
    setFormName('');
    setFormDesc('');
    setFormIsDefault(false);
    setSelectedPerms([]);
    setSelectedClassifications(['Publik', 'Internal']);
    setPermSearch('');
    setEditor({ mode: 'create', role: null });
  };
  const openEdit = (role: Role) => {
    setFormName(role.name);
    setFormDesc(role.description || '');
    setFormIsDefault(false);
    setSelectedPerms([...role.permissions]);
    setSelectedClassifications(
      role.allowed_classifications && role.allowed_classifications.length > 0
        ? [...role.allowed_classifications]
        : ['Publik', 'Internal']
    );
    setPermSearch('');
    setEditor({ mode: 'edit', role });
  };
  const openView = (role: Role) => {
    setFormName(role.name);
    setFormDesc(role.description || '');
    setFormIsDefault(false);
    setSelectedPerms([...role.permissions]);
    setSelectedClassifications(
      role.allowed_classifications && role.allowed_classifications.length > 0
        ? [...role.allowed_classifications]
        : ['Publik', 'Internal']
    );
    setPermSearch('');
    setEditor({ mode: 'view', role });
  };
  const openDuplicate = (role: Role) => {
    setFormName(role.name + ' (Salinan)');
    setFormDesc(role.description || '');
    setFormIsDefault(false);
    setSelectedPerms([...role.permissions]);
    setSelectedClassifications(
      role.allowed_classifications && role.allowed_classifications.length > 0
        ? [...role.allowed_classifications]
        : ['Publik', 'Internal']
    );
    setPermSearch('');
    setEditor({ mode: 'create', role: null });
    toast.info(`Menduplikasi role "${role.name}". Silakan sesuaikan konfigurasi dan simpan.`);
  };

  /* ── permission helpers ── */
  const togglePerm = (key: PermissionKey) => {
    if (editor?.mode === 'view') return;
    setSelectedPerms((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const toggleCat = (cat: PermissionCategory, selectAll: boolean) => {
    if (editor?.mode === 'view') return;
    const catKeys = PERMISSIONS_CATALOG.filter((p) => p.category === cat).map((p) => p.key);
    setSelectedPerms((prev) =>
      selectAll ? Array.from(new Set([...prev, ...catKeys])) : prev.filter((k) => !catKeys.includes(k))
    );
  };
  const toggleClassification = (cls: DocumentClassification) => {
    if (editor?.mode === 'view') return;
    setSelectedClassifications((prev) =>
      prev.includes(cls)
        ? (prev.length > 1 ? prev.filter((c) => c !== cls) : prev)
        : [...prev, cls]
    );
  };

  /* filtered permissions in modal */
  const visiblePerms = useMemo(() => {
    const q = permSearch.toLowerCase().trim();
    if (!q) return PERMISSIONS_CATALOG;
    return PERMISSIONS_CATALOG.filter(
      (p) =>
        (language === 'en' ? p.labelEn : p.labelId).toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
    );
  }, [permSearch, language]);

  const visibleCats = ALL_CATS.filter((cat) => visiblePerms.some((p) => p.category === cat));

  /* ── save ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || editor.mode === 'view') return;
    if (!formName.trim()) {
      toast.warning('Nama role wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editor.mode === 'create') {
        const id = formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: formName.trim(),
            description: formDesc.trim(),
            permissions: selectedPerms,
            allowed_classifications: selectedClassifications,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal membuat role');
        toast.success('Role baru berhasil dibuat');
      } else if (editor.role) {
        const res = await fetch(`/api/roles/${editor.role.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim(),
            permissions: selectedPerms,
            allowed_classifications: selectedClassifications,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui role');
        toast.success('Role berhasil diperbarui');
      }
      setEditor(null);
      await fetchRoles();
      await refreshUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── delete ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.is_system) {
      toast.error('Role sistem tidak dapat dihapus');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus role');
      toast.success(`Role "${deleteTarget.name}" berhasil dihapus`);
      setDeleteTarget(null);
      await fetchRoles();
      await refreshUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReadOnly = editor?.mode === 'view';
  const totalSelected = selectedPerms.length;

  return (
    <div className="enterprise-page-container">


      {/* ── Main Stream Card (Linear / Vercel Enterprise Style) ── */}
      <div
        className="enterprise-card"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Card Header Controls */}
        <div
          className="enterprise-card-header"
          style={{
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '8px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderBottom: '1px solid var(--border-default, #e2e8f0)',
          }}
        >
          {/* Left: Page Title + Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text-primary)', lineHeight: 1.25 }}>
                {language === 'en' ? 'Roles & Permissions' : 'Role & Hak Akses'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {filtered.length} role
              </div>
            </div>
          </div>

          {/* Right: Search + New Role */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '9999px',
                padding: '0 8px 0 10px',
                height: '26px',
                width: '220px',
                gap: '6px',
              }}
            >
              <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={language === 'en' ? 'Search role...' : 'Cari role atau deskripsi...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '11.5px',
                  color: 'var(--text-primary)',
                  padding: 0,
                  minWidth: 0,
                }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '26px',
                  padding: '0 11px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  color: '#ffffff',
                  backgroundColor: '#0f172a',
                  border: '1px solid #0f172a',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0f172a'; }}
              >
                <Plus size={11} strokeWidth={2.4} />
                <span>{language === 'en' ? 'New Role' : 'Role Baru'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Table Content ── */}
        <div className="enterprise-table-wrapper">
          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
            <thead>
              <tr>
                {[
                  { label: 'Role & Deskripsi', width: '32%', align: 'left' },
                  { label: 'Pengguna', width: '10%', align: 'center' },
                  { label: 'Cakupan Izin', width: '16%', align: 'center' },
                  { label: 'Klasifikasi Akses', width: '26%', align: 'center' },
                  { label: 'Aksi', width: '16%', align: 'center' },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      padding: '8px 14px',
                      fontWeight: 600,
                      fontSize: '11px',
                      letterSpacing: '0.02em',
                      color: 'var(--text-secondary)',
                      textAlign: col.align as any,
                      verticalAlign: 'middle',
                      width: col.width,
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                      <Loader2 size={16} className="animate-spin" color="var(--color-primary, #2563eb)" />
                      <span>Memuat data role...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', verticalAlign: 'middle' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                      Tidak ada role yang cocok
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '11.5px' }}>
                      Coba sesuaikan kata kunci pencarian.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((role) => (
                  <tr
                    key={role.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Role Info */}
                    <td style={{ padding: '10px 14px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 600,
                                padding: '1px 7px',
                                borderRadius: '9999px',
                                backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                                border: '1px solid var(--border-default, #e2e8f0)',
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Lock size={9} />
                              Terkunci
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                            {role.description}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Pengguna */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono, monospace)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Users size={12} color="var(--text-muted)" />
                        {role.user_count ?? 0}
                      </span>
                    </td>

                    {/* Permission Count */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          backgroundColor:
                            role.permissions.length > 0
                              ? 'rgba(37, 99, 235, 0.08)'
                              : 'var(--bg-subtle, #f1f5f9)',
                          color: role.permissions.length > 0 ? '#2563eb' : 'var(--text-muted)',
                          border: `1px solid ${
                            role.permissions.length > 0 ? 'rgba(37, 99, 235, 0.18)' : 'var(--border-default, #e2e8f0)'
                          }`,
                        }}
                      >
                        {role.permissions.length} Hak Akses
                      </span>
                    </td>

                    {/* Klasifikasi Akses */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', maxWidth: '280px' }}>
                        {(role.allowed_classifications && role.allowed_classifications.length > 0
                          ? role.allowed_classifications
                          : (role.id === 'admin' ? ALL_CLASSIFICATIONS.map(c => c.key) : ['Publik', 'Internal'])
                        ).map((clsKey) => {
                          const meta = ALL_CLASSIFICATIONS.find(c => c.key === clsKey) || {
                            label: clsKey,
                            color: '#64748b',
                            bg: '#f8fafc',
                            border: '#e2e8f0',
                          };
                          return (
                            <span
                              key={clsKey}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                backgroundColor: meta.bg,
                                color: meta.color,
                                border: `1px solid ${meta.border}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {meta.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        {role.is_system ? (
                          <IBtn title="Lihat detail role" onClick={() => openView(role)}>
                            <Eye size={12} />
                          </IBtn>
                        ) : (
                          canManage && (
                            <IBtn title="Edit role" onClick={() => openEdit(role)}>
                              <Pencil size={12} />
                            </IBtn>
                          )
                        )}

                        {canManage && (
                          <IBtn title="Duplikasi role ini" onClick={() => openDuplicate(role)}>
                            <Copy size={12} />
                          </IBtn>
                        )}

                        {canManage && !role.is_system && (
                          <IBtn title="Hapus role" onClick={() => setDeleteTarget(role)} danger>
                            <Trash2 size={12} />
                          </IBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Enterprise Pagination Bar (Always pinned at bottom) ── */}
        <EnterprisePagination
          currentPage={safeCurrentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setPage(1);
          }}
          language={language}
        />
      </div>

      {/* ════ MODAL: Buat / Edit / View Role ════ */}
      {editor && (
        <div style={OL} onClick={() => setEditor(null)}>
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '640px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '88vh',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.15rem 1.4rem',
                borderBottom: '1px solid var(--border-default, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editor.mode === 'create'
                    ? 'Buat Role Baru'
                    : editor.mode === 'edit'
                    ? 'Edit Konfigurasi Role'
                    : 'Detail Role Sistem'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Tentukan informasi umum dan matriks hak akses modular untuk role ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.4rem' }}>
              <form id="roleForm" onSubmit={handleSave}>
                {/* Form Row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={LBL}>Nama Role *</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Contoh: Tim Verifikasi"
                      style={INP}
                      autoFocus={!isReadOnly}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        border: '1px solid var(--border-default, #e2e8f0)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flex: 1,
                        marginTop: '20px',
                        backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-primary)' }}>Role Default</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Otomatis untuk akun baru</div>
                      </div>
                      <Toggle checked={formIsDefault} onChange={setFormIsDefault} disabled={isReadOnly} />
                    </div>
                  </div>
                </div>

                {/* Deskripsi */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={LBL}>Deskripsi Fungsional</label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    disabled={isReadOnly}
                    rows={2}
                    placeholder="Jelaskan ruang lingkup hak akses role ini..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* ── Izin Klasifikasi Dokumen (Security Clearance) ── */}
                <div
                  style={{
                    marginBottom: '18px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Shield size={15} color="#2563eb" />
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                        Izin Tingkat Kerahasiaan Dokumen (Security Clearance)
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 8px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        color: '#2563eb',
                        border: '1px solid rgba(37, 99, 235, 0.18)',
                      }}
                    >
                      {selectedClassifications.length} dari {ALL_CLASSIFICATIONS.length} diizinkan
                    </span>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Menentukan tingkat klasifikasi dokumen divisi yang berhak dicari, dibaca, dan digunakan dalam prompt AI oleh pengguna dengan role ini.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
                    {ALL_CLASSIFICATIONS.map((c) => {
                      const isChecked = selectedClassifications.includes(c.key);
                      return (
                        <label
                          key={c.key}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1.5px solid ${isChecked ? c.color : 'var(--border-default, #e2e8f0)'}`,
                            backgroundColor: isChecked ? c.bg : 'var(--bg-card, #ffffff)',
                            cursor: isReadOnly ? 'default' : 'pointer',
                            transition: 'all 0.15s ease',
                            userSelect: 'none',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              if (isReadOnly) return;
                              if (e.target.checked) {
                                setSelectedClassifications((prev) => [...prev, c.key]);
                              } else {
                                setSelectedClassifications((prev) => prev.filter((k) => k !== c.key));
                              }
                            }}
                            style={{
                              marginTop: '2px',
                              accentColor: c.color,
                              cursor: isReadOnly ? 'default' : 'pointer',
                              width: '15px',
                              height: '15px',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: isChecked ? c.color : 'var(--text-primary)' }}>
                                {c.label}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                              {c.desc}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Permission Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      Katalog Hak Akses
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        color: '#2563eb',
                        border: '1px solid rgba(37, 99, 235, 0.18)',
                      }}
                    >
                      {totalSelected} dari {PERMISSIONS_CATALOG.length} aktif
                    </span>
                  </div>

                  <div style={{ position: 'relative', flex: 1, maxWidth: '240px' }}>
                    <Search
                      size={12}
                      style={{
                        position: 'absolute',
                        left: '9px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Filter izin..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      style={{ ...INP, paddingLeft: '28px', height: '30px', fontSize: '11.5px' }}
                    />
                  </div>
                </div>

                {/* Permission Category Groups */}
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  {visibleCats.map((cat, catIdx) => {
                    const catPerms = visiblePerms.filter((p) => p.category === cat);
                    const allCatKeys = PERMISSIONS_CATALOG.filter((p) => p.category === cat).map((p) => p.key);
                    const selectedInCat = selectedPerms.filter((k) => allCatKeys.includes(k)).length;
                    const allSelected = selectedInCat === allCatKeys.length;

                    return (
                      <div
                        key={cat}
                        style={{ borderTop: catIdx > 0 ? '1px solid var(--border-default, #e2e8f0)' : 'none' }}
                      >
                        {/* Category Header */}
                        <div
                          style={{
                            padding: '8px 12px',
                            backgroundColor: 'var(--bg-subtle, #f8fafc)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                              {CAT_LABELS[cat]}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({selectedInCat}/{allCatKeys.length})
                            </span>
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => toggleCat(cat, !allSelected)}
                              style={{
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                border: '1px solid var(--border-default, #e2e8f0)',
                                background: 'var(--bg-card, #ffffff)',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {allSelected ? 'Hapus Semua' : 'Pilih Semua'}
                            </button>
                          )}
                        </div>

                        {/* Permission Items Grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '6px',
                            padding: '8px 10px',
                            backgroundColor: 'var(--bg-card, #ffffff)',
                          }}
                        >
                          {catPerms.map((perm) => {
                            const isChecked = selectedPerms.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  cursor: isReadOnly ? 'default' : 'pointer',
                                  backgroundColor: isChecked ? '#eff6ff' : 'var(--bg-subtle, #f8fafc)',
                                  border: `1px solid ${isChecked ? '#bfdbfe' : 'var(--border-default, #e2e8f0)'}`,
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isReadOnly}
                                  onChange={() => togglePerm(perm.key)}
                                  style={{
                                    marginTop: '2px',
                                    accentColor: '#2563eb',
                                    width: '14px',
                                    height: '14px',
                                    cursor: isReadOnly ? 'default' : 'pointer',
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                                    {language === 'en' ? perm.labelEn : perm.labelId}
                                  </div>
                                  <code
                                    style={{
                                      display: 'block',
                                      fontSize: '10px',
                                      color: 'var(--text-muted)',
                                      fontFamily: 'monospace',
                                      marginTop: '1px',
                                    }}
                                  >
                                    {perm.key}
                                  </code>
                                  <div
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--text-secondary)',
                                      marginTop: '2px',
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    {language === 'en' ? perm.descEn : perm.descId}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {visibleCats.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Tidak ada izin yang cocok dengan kata kunci pencarian.
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.85rem 1.4rem',
                borderTop: '1px solid var(--border-default, #e2e8f0)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setEditor(null)}
                style={{
                  height: '28px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                {isReadOnly ? 'Tutup' : 'Batal'}
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  form="roleForm"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '28px',
                    padding: '0 16px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#FFFFFF',
                    backgroundColor: '#2563EB',
                    border: '1px solid #1D4ED8',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Simpan Role
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Konfirmasi Hapus ════ */}
      {deleteTarget && (
        <div style={OL} onClick={() => setDeleteTarget(null)}>
          <div style={{ ...BOX(420) }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Hapus Role Akses?
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus role <strong>&quot;{deleteTarget.name}&quot;</strong>? Semua pengguna dengan role ini
              akan kehilangan hak akses terkait.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  height: '28px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                style={{
                  height: '28px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : 'Hapus Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
