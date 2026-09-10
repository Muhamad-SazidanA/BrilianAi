'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Eye, Pencil, RotateCcw, X, Loader2, ChevronLeft, ChevronRight, ChevronDown, Save } from 'lucide-react';
import { User, Role } from '@/types/user';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#2563eb', member: '#16a34a', viewer: '#9333ea',
  finance: '#d97706', direktur: '#0891b2', sales: '#db2777',
};
function roleDot(rid: string) { return ROLE_COLORS[rid.toLowerCase()] ?? '#6b7280'; }

const cardS: React.CSSProperties = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' };
const OL: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' };
function BOX(w = 520): React.CSSProperties { return { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: `${w}px`, padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }; }
const LBL: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' };
const INP: React.CSSProperties = { width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-default)', fontSize: '13.5px', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)', outline: 'none', boxSizing: 'border-box' };

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  const ok = status === 'active';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: ok ? '#f0fdf4' : 'var(--bg-subtle)', color: ok ? '#16a34a' : 'var(--text-muted)', border: `1px solid ${ok ? '#bbf7d0' : 'var(--border-default)'}` }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: ok ? '#16a34a' : 'var(--text-muted)' }} />
      {ok ? 'aktif' : 'nonaktif'}
    </span>
  );
}

function IBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border-default)', background: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
      {children}
    </button>
  );
}

function PBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ height: '28px', minWidth: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: active ? 'var(--bg-subtle)' : 'transparent', color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '12.5px', fontWeight: active ? 600 : 400, cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: '44px', height: '24px', borderRadius: '9999px', border: 'none', cursor: 'pointer', backgroundColor: checked ? 'var(--color-primary)' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '3px', left: checked ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

export default function UsersManagementView() {
  const { language } = useLanguage();
  const { hasPermission, refreshUsers: refreshSessionUsers } = useUserSession();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cDept, setCDept] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cRoleId, setCRoleId] = useState('member');
  const [cActive, setCActive] = useState(true);

  // Edit form
  const [eName, setEName] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eDept, setEDept] = useState('');
  const [eRoleId, setERoleId] = useState('member');
  const [eStatus, setEStatus] = useState<'active' | 'inactive'>('active');

  const canManage = hasPermission('users:manage');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles')]);
      if (uRes.ok) setUsers((await uRes.json()).users || []);
      if (rRes.ok) setRoles((await rRes.json()).roles || []);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter(u => {
      const ms = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.department ?? '').toLowerCase().includes(q);
      const mst = statusFilter === 'all' || u.status === statusFilter;
      return ms && mst;
    });
  }, [users, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => { const s = (page - 1) * pageSize; return filtered.slice(s, s + pageSize); }, [filtered, page, pageSize]);

  const openCreate = () => { setCName(''); setCEmail(''); setCDept(''); setCPassword(''); setCRoleId(roles[0]?.id || 'member'); setCActive(true); setShowCreate(true); };
  const openEdit = (u: User) => { setEName(u.name); setEEmail(u.email); setEDept(u.department || ''); setERoleId(u.role_id); setEStatus(u.status); setDetailUser(null); setEditingUser(u); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cEmail.trim()) { toast.warning('Nama dan Email wajib diisi'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cName, email: cEmail, role_id: cRoleId, department: cDept, status: cActive ? 'active' : 'inactive' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pengguna');
      toast.success('Pengguna berhasil dibuat'); setShowCreate(false);
      await fetchUsers(); await refreshSessionUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: eName, email: eEmail, role_id: eRoleId, department: eDept, status: eStatus }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui');
      toast.success('Data pengguna berhasil diperbarui'); setEditingUser(null);
      await fetchUsers(); await refreshSessionUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSubmitting(false); }
  };

  const toggleStatus = async (u: User) => {
    if (!canManage) { toast.error('Tidak memiliki hak akses'); return; }
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
      if (!res.ok) throw new Error('Gagal memperbarui status');
      toast.success(next === 'active' ? `Akun ${u.name} diaktifkan` : `Akun ${u.name} dinonaktifkan`);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: next } : x));
      if (detailUser?.id === u.id) setDetailUser(d => d ? { ...d, status: next } : d);
      await refreshSessionUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!deletingUser) return; setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      toast.success('Pengguna berhasil dihapus'); setDeletingUser(null);
      await fetchUsers(); await refreshSessionUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Kelola User</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: '3px 0 0' }}>Kelola akun user, detail profil, sesi, dan status akun.</p>
      </div>

      {/* Main Card */}
      <div style={cardS}>
        {/* Card Header */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Daftar user</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>Cari user dan kelola status akun dari satu tempat.</p>
          </div>
          {canManage && (
            <button type="button" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={15} /><span>+ User baru</span>
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '380px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Cari berdasarkan nama, email, atau username" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              style={{ ...INP, paddingLeft: '32px', height: '34px', fontSize: '12.5px' }} />
          </div>
          <div style={{ display: 'inline-flex', borderRadius: '8px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            {(['all', 'active', 'inactive'] as const).map(s => {
              const isA = statusFilter === s;
              const txt = s === 'all' ? 'Semua' : s === 'active' ? 'aktif' : 'nonaktif';
              return (
                <button key={s} type="button" onClick={() => { setStatusFilter(s); setPage(1); }}
                  style={{ padding: '5px 16px', fontSize: '13px', fontWeight: isA ? 600 : 400, border: 'none', borderLeft: s !== 'all' ? '1px solid var(--border-default)' : 'none', backgroundColor: isA ? 'var(--bg-subtle)' : 'transparent', color: isA ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                  {txt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderTop: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)' }}>
                {['User', 'Username', 'Roles', 'Departemen', 'Pertanyaan AI', 'Login terakhir', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={{ padding: '9px 1rem', fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Loader2 size={16} className="animate-spin" color="var(--color-primary)" /><span>Memuat data pengguna...</span></div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{searchQuery ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Coba sesuaikan kata kunci pencarian atau filter.</p>
                </td></tr>
              ) : paginated.map(u => {
                const isSA = u.id === 'a0000000-0000-0000-0000-000000000001';
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border-subtle)', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '10px 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <UserAvatar name={u.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 1rem', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{u.email.split('@')[0]}</td>
                    <td style={{ padding: '10px 1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-subtle)', fontSize: '12px', color: 'var(--text-primary)' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: roleDot(u.role_id), flexShrink: 0 }} />
                        {u.role?.name || u.role_id}
                      </span>
                    </td>
                    <td style={{ padding: '10px 1rem', fontSize: '12.5px', color: 'var(--text-secondary)' }}>{u.department || '-'}</td>
                    <td style={{ padding: '10px 1rem', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center' }}>{u.question_count ?? 0}</td>
                    <td style={{ padding: '10px 1rem', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td style={{ padding: '10px 1rem' }}><StatusBadge status={u.status} /></td>
                    <td style={{ padding: '10px 1rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <IBtn title="Lihat detail" onClick={() => setDetailUser(u)}><Eye size={13} /></IBtn>
                        {canManage && <IBtn title="Edit user" onClick={() => openEdit(u)}><Pencil size={13} /></IBtn>}
                        {canManage && !isSA && <IBtn title="Revoke sesi" onClick={() => toast.info('Fitur revoke sesi belum tersedia')}><RotateCcw size={13} /></IBtn>}
                        {canManage && !isSA && (
                          <button type="button" onClick={() => toggleStatus(u)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-default)', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
                  {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
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

      {/* MODAL: Buat User */}
      {showCreate && (
        <div style={OL} onClick={() => setShowCreate(false)}>
          <div style={BOX(500)} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Buat user</h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Buat akun user lokal dengan password awal.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><span style={LBL}>Nama</span><input type="text" required value={cName} onChange={e => setCName(e.target.value)} style={INP} autoFocus /></div>
                <div><span style={LBL}>Email</span><input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} style={INP} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '4px' }}>
                <div><span style={LBL}>Departemen</span><input type="text" placeholder="johndoe" value={cDept} onChange={e => setCDept(e.target.value)} style={INP} /></div>
                <div><span style={LBL}>Role</span><select value={cRoleId} onChange={e => setCRoleId(e.target.value)} style={INP}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>Atur departemen agar user lebih mudah dikelola.</p>
              <div style={{ marginBottom: '4px' }}><span style={LBL}>Password</span><input type="password" value={cPassword} onChange={e => setCPassword(e.target.value)} style={INP} /></div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>Bagikan password awal ini melalui kanal yang aman.</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-default)', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>Akun aktif</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>User aktif dapat langsung login.</div>
                </div>
                <Toggle checked={cActive} onChange={setCActive} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>Batal</button>
                <button type="submit" disabled={isSubmitting} style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: isSubmitting ? 0.7 : 1 }}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Buat user
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detail User */}
      {detailUser && (
        <div style={OL} onClick={() => setDetailUser(null)}>
          <div style={{ ...BOX(520), maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Detail user</h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Lihat detail akun, keanggotaan tim, dan aktivitas sesi.</p>
              </div>
              <button type="button" onClick={() => setDetailUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            {/* User header */}
            <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', padding: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <UserAvatar name={detailUser.name} size={40} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{detailUser.name}</span>
                    <StatusBadge status={detailUser.status} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{detailUser.email}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{detailUser.email.split('@')[0]}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {canManage && (
                  <button type="button" onClick={() => openEdit(detailUser)} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '12.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                    <Pencil size={12} />Edit user
                  </button>
                )}
                <button type="button" onClick={() => toast.info('Fitur revoke sesi belum tersedia')} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '12.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                  <RotateCcw size={12} />Revoke sesi
                </button>
                {canManage && detailUser.id !== 'a0000000-0000-0000-0000-000000000001' && (
                  <button type="button" onClick={() => toggleStatus(detailUser)} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '12.5px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    {detailUser.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                )}
              </div>
            </div>
            {/* Info grid row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '8px' }}>
              {[{ l: 'DEPARTEMEN', v: detailUser.department || '-' }, { l: 'PERTANYAAN AI', v: String(detailUser.question_count ?? 0) }, { l: 'SESI AKTIF', v: '—' }, { l: 'STATUS', v: detailUser.status === 'active' ? 'Aktif' : 'Nonaktif' }].map(({ l, v }) => (
                <div key={l} style={{ border: '1px solid var(--border-default)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{l}</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Info grid row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
              {[{ l: 'LOGIN TERAKHIR', v: fmtDate(detailUser.last_login_at) }, { l: 'DIBUAT', v: fmtDate(detailUser.created_at) }, { l: 'DIPERBARUI', v: fmtDate(detailUser.updated_at) }].map(({ l, v }) => (
                <div key={l} style={{ border: '1px solid var(--border-default)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>{l}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Roles */}
            <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '3px' }}>Roles</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>Access roles assigned to this user.</p>
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: roleDot(detailUser.role_id) }} />
                  {detailUser.role?.name || detailUser.role_id}
                </span>
                <ChevronDown size={14} color="var(--text-muted)" />
              </div>
            </div>
            {/* Keanggotaan tim */}
            <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '3px' }}>Keanggotaan tim</div>
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px', marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {detailUser.department ? `Anggota tim: ${detailUser.department}` : 'User ini belum masuk ke tim mana pun.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {editingUser && (
        <div style={OL} onClick={() => setEditingUser(null)}>
          <div style={BOX(480)} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit user</h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Perbarui identitas akun dan informasi kontak.</p>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><span style={LBL}>Nama</span><input type="text" required value={eName} onChange={e => setEName(e.target.value)} style={INP} /></div>
                <div><span style={LBL}>Email</span><input type="email" value={eEmail} onChange={e => setEEmail(e.target.value)} style={INP} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '4px' }}>
                <div><span style={LBL}>Departemen</span><input type="text" value={eDept} onChange={e => setEDept(e.target.value)} style={INP} /></div>
                <div><span style={LBL}>Role</span><select value={eRoleId} onChange={e => setERoleId(e.target.value)} style={INP}>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>Atur departemen agar user lebih mudah dikelola.</p>
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={LBL}>Status akun</span>
                <select value={eStatus} onChange={e => setEStatus(e.target.value as any)} style={INP}>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setEditingUser(null)} style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>Batal</button>
                <button type="submit" disabled={isSubmitting} style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: isSubmitting ? 0.7 : 1 }}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Simpan perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Hapus */}
      {deletingUser && (
        <div style={OL} onClick={() => setDeletingUser(null)}>
          <div style={BOX(420)} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Hapus akun pengguna?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus akun &quot;{deletingUser.name}&quot; ({deletingUser.email})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setDeletingUser(null)} style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'none', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>Batal</button>
              <button type="button" onClick={handleDelete} disabled={isSubmitting} style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
