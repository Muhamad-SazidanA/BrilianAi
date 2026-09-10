'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck, Plus, Search, X, Lock, Loader2,
  Users, ChevronLeft, ChevronRight, ChevronDown,
  Trash2, Pencil, Eye, Copy, Save,
} from 'lucide-react';
import { Role, PermissionKey, PERMISSIONS_CATALOG, PermissionCategory } from '@/types/user';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

/* ─── Category labels ─────────────────────────────── */
const CAT_LABELS: Record<PermissionCategory, string> = {
  documents: 'Dokumen & Ingestion',
  curation: 'Kurasi AI',
  chat: 'Asisten AI & Chat',
  administration: 'Administrasi',
};
const ALL_CATS = Object.keys(CAT_LABELS) as PermissionCategory[];

/* ─── Shared style constants ──────────────────────── */
const cardS: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};
const OL: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: '1.5rem',
};
const INP: React.CSSProperties = {
  width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px',
  border: '1px solid var(--border-default)', fontSize: '13.5px',
  color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)',
  outline: 'none', boxSizing: 'border-box',
};
const LBL: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600,
  color: 'var(--text-primary)', marginBottom: '6px',
};

/* ─── Sub-components ──────────────────────────────── */
function IBtn({ children, onClick, title, danger }: {
  children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean;
}) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: danger ? '#dc2626' : 'var(--text-secondary)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = danger ? '#fef2f2' : 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
      {children}
    </button>
  );
}

function PBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ height: '28px', minWidth: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: active ? 'var(--bg-subtle)' : 'transparent', color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '12.5px', fontWeight: active ? 600 : 400, cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => !disabled && onChange(!checked)}
      style={{ width: '44px', height: '24px', borderRadius: '9999px', border: 'none', cursor: disabled ? 'default' : 'pointer', backgroundColor: checked ? 'var(--color-primary)' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      <span style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════ */
export default function RolesPermissionsView() {
  const { language } = useLanguage();
  const { hasPermission, refreshUsers } = useUserSession();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* Editor modal */
  type EditorMode = 'create' | 'edit' | 'view';
  const [editor, setEditor] = useState<{ mode: EditorMode; role: Role | null } | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<PermissionKey[]>([]);
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
    } catch (err: any) {
      toast.error('Gagal memuat role: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  /* ── filter + paginate ── */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return roles;
    return roles.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
  }, [roles, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const s = (page - 1) * pageSize;
    return filtered.slice(s, s + pageSize);
  }, [filtered, page, pageSize]);

  /* ── open editor ── */
  const openCreate = () => {
    setFormName(''); setFormDesc(''); setFormIsDefault(false);
    setSelectedPerms([]); setPermSearch('');
    setEditor({ mode: 'create', role: null });
  };
  const openEdit = (role: Role) => {
    setFormName(role.name); setFormDesc(role.description || '');
    setFormIsDefault(false); setSelectedPerms([...role.permissions]);
    setPermSearch('');
    setEditor({ mode: 'edit', role });
  };
  const openView = (role: Role) => {
    setFormName(role.name); setFormDesc(role.description || '');
    setFormIsDefault(false); setSelectedPerms([...role.permissions]);
    setPermSearch('');
    setEditor({ mode: 'view', role });
  };
  const openDuplicate = (role: Role) => {
    setFormName(role.name + ' (Copy)'); setFormDesc(role.description || '');
    setFormIsDefault(false); setSelectedPerms([...role.permissions]);
    setPermSearch('');
    setEditor({ mode: 'create', role: null });
    toast.info(`Menduplikasi role "${role.name}". Silakan tinjau dan simpan.`);
  };

  /* ── permission helpers ── */
  const togglePerm = (key: PermissionKey) => {
    if (editor?.mode === 'view') return;
    setSelectedPerms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const toggleCat = (cat: PermissionCategory, selectAll: boolean) => {
    if (editor?.mode === 'view') return;
    const catKeys = PERMISSIONS_CATALOG.filter(p => p.category === cat).map(p => p.key);
    setSelectedPerms(prev => selectAll
      ? Array.from(new Set([...prev, ...catKeys]))
      : prev.filter(k => !catKeys.includes(k)));
  };

  /* filtered permissions in modal */
  const visiblePerms = useMemo(() => {
    const q = permSearch.toLowerCase();
    if (!q) return PERMISSIONS_CATALOG;
    return PERMISSIONS_CATALOG.filter(p =>
      (language === 'en' ? p.labelEn : p.labelId).toLowerCase().includes(q) ||
      p.key.toLowerCase().includes(q)
    );
  }, [permSearch, language]);

  /* visible cats that have at least one visible perm */
  const visibleCats = ALL_CATS.filter(cat => visiblePerms.some(p => p.category === cat));

  /* ── save ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor || editor.mode === 'view') return;
    if (!formName.trim()) { toast.warning('Nama role wajib diisi'); return; }

    setIsSubmitting(true);
    try {
      if (editor.mode === 'create') {
        const id = formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name: formName.trim(), description: formDesc.trim(), permissions: selectedPerms }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal membuat role');
        toast.success('Role baru berhasil dibuat');
      } else if (editor.role) {
        const res = await fetch(`/api/roles/${editor.role.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), description: formDesc.trim(), permissions: selectedPerms }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui role');
        toast.success('Role berhasil diperbarui');
      }
      setEditor(null);
      await fetchRoles(); await refreshUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSubmitting(false); }
  };

  /* ── delete ── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.is_system) { toast.error('Role sistem tidak dapat dihapus'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus role');
      toast.success(`Role "${deleteTarget.name}" berhasil dihapus`);
      setDeleteTarget(null);
      await fetchRoles(); await refreshUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSubmitting(false); }
  };

  const isReadOnly = editor?.mode === 'view';
  const totalSelected = selectedPerms.length;

  /* ════════════ RENDER ════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={22} color="var(--color-primary)" />Role & Hak Akses
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: '3px 0 0' }}>
          Kelola role dan akses fitur berbasis permission.
        </p>
      </div>

      {/* Main Card */}
      <div style={cardS}>
        {/* Card Header */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Daftar role</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--color-primary)' }}>
              Daftar role dan permission yang tersedia.
            </p>
          </div>
          {canManage && (
            <button type="button" onClick={openCreate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={15} /><span>+ Role baru</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-default)' }}>
          <div style={{ position: 'relative', maxWidth: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Cari role..." value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              style={{ ...INP, paddingLeft: '32px', height: '34px', fontSize: '12.5px' }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderTop: '1px solid var(--border-default)' }}>
                {[['Role', '60%'], ['Pengguna', '10%'], ['Permission', '12%'], ['Aksi', '18%']].map(([h, w]) => (
                  <th key={h} style={{ padding: '9px 1rem', fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)', textAlign: h === 'Aksi' ? 'right' : 'left', width: w }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Loader2 size={16} className="animate-spin" color="var(--color-primary)" /><span>Memuat role...</span></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Tidak ada role yang cocok</p>
                </td></tr>
              ) : paginated.map(role => (
                <tr key={role.id}
                  style={{ borderTop: '1px solid var(--border-subtle)', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>

                  {/* Role info */}
                  <td style={{ padding: '12px 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>{role.name}</span>
                      {role.is_system && (
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '9999px', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Lock size={9} />Terkunci
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-primary)' }}>{role.description}</p>
                    )}
                  </td>

                  {/* Pengguna */}
                  <td style={{ padding: '12px 1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <Users size={13} color="var(--text-muted)" />{role.user_count ?? 0}
                    </span>
                  </td>

                  {/* Permission count */}
                  <td style={{ padding: '12px 1rem' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: role.permissions.length > 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                      {role.permissions.length}
                    </span>
                  </td>

                  {/* Aksi */}
                  <td style={{ padding: '12px 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {role.is_system
                        ? <IBtn title="Lihat detail" onClick={() => openView(role)}><Eye size={14} /></IBtn>
                        : canManage && <IBtn title="Edit role" onClick={() => openEdit(role)}><Pencil size={14} /></IBtn>
                      }
                      {canManage && (
                        <IBtn title="Duplikasi role" onClick={() => openDuplicate(role)}><Copy size={14} /></IBtn>
                      )}
                      {canManage && !role.is_system && (
                        <IBtn title="Hapus role" onClick={() => setDeleteTarget(role)} danger><Trash2 size={14} /></IBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '8px' }}>
          <span>Halaman {page} / {totalPages}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Baris per halaman</span>
              <div style={{ position: 'relative' }}>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ height: '28px', padding: '0 24px 0 8px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '12.5px', appearance: 'none', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  {[5, 10, 25].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={13} />Prev Page</PBtn>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
                <PBtn key={pg} onClick={() => setPage(pg)} active={page === pg}>{pg}</PBtn>
              ))}
              <PBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next Page<ChevronRight size={13} /></PBtn>
            </div>
          </div>
        </div>
      </div>

      {/* ════ MODAL: Buat / Edit / View Role ════ */}
      {editor && (
        <div style={OL} onClick={() => setEditor(null)}>
          <div
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '620px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>

            {/* Fixed Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editor.mode === 'create' ? 'Buat role' : editor.mode === 'edit' ? 'Edit role' : 'Detail role'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Atur informasi role dan permission yang diberikan.
                </p>
              </div>
              <button type="button" onClick={() => setEditor(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
              <form id="roleForm" onSubmit={handleSave}>

                {/* Row 1: Nama role | Role default toggle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <span style={LBL}>Nama role</span>
                    <input type="text" required value={formName} onChange={e => setFormName(e.target.value)}
                      disabled={isReadOnly}
                      style={{ ...INP, borderColor: !isReadOnly ? 'var(--color-primary)' : 'var(--border-default)', boxShadow: !isReadOnly ? '0 0 0 2px rgba(37,99,235,0.12)' : 'none' }}
                      autoFocus={!isReadOnly} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flex: 1, marginTop: '23px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Role default</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>Diberikan otomatis kepada user baru.</div>
                      </div>
                      <Toggle checked={formIsDefault} onChange={setFormIsDefault} disabled={isReadOnly} />
                    </div>
                  </div>
                </div>

                {/* Deskripsi */}
                <div style={{ marginBottom: '20px' }}>
                  <span style={LBL}>Deskripsi</span>
                  <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)}
                    disabled={isReadOnly} rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '13.5px', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>

                {/* Permission section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Permission</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-primary)', marginTop: '1px' }}>
                      {totalSelected} dipilih
                    </div>
                  </div>
                  <div style={{ position: 'relative', flex: 1, maxWidth: '260px' }}>
                    <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Cari permission..." value={permSearch}
                      onChange={e => setPermSearch(e.target.value)}
                      style={{ ...INP, paddingLeft: '28px', height: '34px', fontSize: '12.5px' }} />
                  </div>
                </div>

                {/* Permission category groups */}
                <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
                  {visibleCats.map((cat, catIdx) => {
                    const catPerms = visiblePerms.filter(p => p.category === cat);
                    const allCatKeys = PERMISSIONS_CATALOG.filter(p => p.category === cat).map(p => p.key);
                    const selectedInCat = selectedPerms.filter(k => allCatKeys.includes(k)).length;
                    const allSelected = selectedInCat === allCatKeys.length;

                    return (
                      <div key={cat} style={{ borderTop: catIdx > 0 ? '1px solid var(--border-default)' : 'none' }}>
                        {/* Category header */}
                        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>{CAT_LABELS[cat]}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {selectedInCat}/{allCatKeys.length} dipilih
                            </div>
                          </div>
                          {!isReadOnly && (
                            <button type="button" onClick={() => toggleCat(cat, !allSelected)}
                              style={{ padding: '4px 12px', borderRadius: '7px', border: '1px solid var(--border-default)', background: 'var(--bg-card)', fontSize: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                              {allSelected ? 'Hapus semua' : 'Pilih semua'}
                            </button>
                          )}
                        </div>
                        {/* Permission items grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', padding: '10px', backgroundColor: 'var(--bg-card)' }}>
                          {catPerms.map(perm => {
                            const isChecked = selectedPerms.includes(perm.key);
                            return (
                              <label key={perm.key}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', borderRadius: '8px', cursor: isReadOnly ? 'default' : 'pointer', backgroundColor: isChecked ? '#eff6ff' : 'transparent', border: `1px solid ${isChecked ? '#bfdbfe' : 'transparent'}`, margin: '3px', transition: 'all 0.12s' }}>
                                <input type="checkbox" checked={isChecked} disabled={isReadOnly}
                                  onChange={() => togglePerm(perm.key)}
                                  style={{ marginTop: '2px', accentColor: 'var(--color-primary)', width: '15px', height: '15px', cursor: isReadOnly ? 'default' : 'pointer' }} />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                                    {language === 'en' ? perm.labelEn : perm.labelId}
                                  </div>
                                  <code style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '1px' }}>{perm.key}</code>
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
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
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Tidak ada permission yang cocok.
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Fixed Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
              <button type="button" onClick={() => setEditor(null)}
                style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                Batal
              </button>
              {!isReadOnly && (
                <button type="submit" form="roleForm" disabled={isSubmitting}
                  style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: isSubmitting ? 0.7 : 1 }}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan role
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Konfirmasi Hapus ════ */}
      {deleteTarget && (
        <div style={OL} onClick={() => setDeleteTarget(null)}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '420px', padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Hapus role?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus role &quot;{deleteTarget.name}&quot;? Semua user dengan role ini akan kehilangan aksesnya.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setDeleteTarget(null)}
                style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                Batal
              </button>
              <button type="button" onClick={handleDelete} disabled={isSubmitting}
                style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
