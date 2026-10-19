'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DocumentGrant } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { formatDateTime } from '@lib/utils/formatters';
import { Users, UserPlus, Trash2, Shield, Loader2, Check, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import EnterpriseSelect from '@/components/ui/EnterpriseSelect';

interface DocumentGrantsTabProps {
  batchId: string;
  batchTitle?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  department: string;
  role_id: string;
}

export default function DocumentGrantsTab({ batchId }: DocumentGrantsTabProps) {
  const { language } = useLanguage();
  const [grants, setGrants] = useState<DocumentGrant[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'viewer' | 'editor'>('viewer');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [grantsRes, usersRes] = await Promise.all([
        fetch(`/api/documents/${batchId}/grants`),
        fetch('/api/users'),
      ]);

      if (grantsRes.ok) {
        const grantsData = await grantsRes.json();
        setGrants(grantsData.grants || []);
      } else if (grantsRes.status === 403) {
        toast.error('Anda tidak memiliki izin mengelola akses dokumen ini.');
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAllUsers(usersData.users || []);
      }
    } catch (err: any) {
      console.error('Error fetching grants data:', err);
      toast.error('Gagal memuat data hak akses pengguna.');
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Pilih pengguna yang ingin diberikan akses.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${batchId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          accessLevel: selectedLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memberikan hak akses.');
      }

      toast.success(data.message || 'Hak akses berhasil diperbarui.');
      setSelectedUserId('');
      setSelectedLevel('viewer');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (userId: string, userName: string) => {
    if (!confirm(`Cabut hak akses khusus untuk ${userName}?`)) {
      return;
    }

    setRevokingUserId(userId);
    try {
      const res = await fetch(`/api/documents/${batchId}/grants?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mencabut hak akses.');
      }

      toast.success(data.message || 'Hak akses berhasil dicabut.');
      setGrants((prev) => prev.filter((g) => g.user_id !== userId));
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setRevokingUserId(null);
    }
  };

  // Filter out users who already have grants from the dropdown or indicate it
  const grantedUserIds = new Set(grants.map((g) => g.user_id));
  const availableUsers = allUsers.filter((u) => !grantedUserIds.has(u.id));

  return (
    <div className="flex flex-col gap-4">
      {/* Information Banner */}
      <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl flex items-start gap-3 text-slate-700 dark:text-slate-300 shadow-xs">
        <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs leading-relaxed">
          <strong className="text-slate-900 dark:text-slate-100 block mb-0.5 text-xs font-bold">
            Kebijakan Hak Akses Dokumen Khusus (User Whitelist)
          </strong>
          Dokumen ini secara default dilindungi oleh klasifikasi kerahasiaan dan divisi. Anda dapat menambahkan pengguna tertentu ke dalam daftar izin di bawah ini untuk memberi mereka hak akses langsung, meskipun jabatan atau divisinya tidak mencakup dokumen ini.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        {/* Table of Active Grants */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">
                Pengguna dengan Akses Khusus ({grants.length})
              </h3>
            </div>
            {isLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-slate-500 text-xs">
              <Loader2 size={18} className="animate-spin mx-auto mb-2 text-blue-600" />
              Memuat daftar izin pengguna...
            </div>
          ) : grants.length === 0 ? (
            <div className="p-10 text-center bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <Shield size={26} className="text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Belum ada pengguna khusus
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Dokumen hanya dapat diakses sesuai batasan Divisi dan Klasifikasi standar. Gunakan formulir di samping untuk menambahkan akses khusus.
              </div>
            </div>
          ) : (
            <div className="enterprise-table-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 font-semibold text-[11px]">
                    <th className="py-2.5 px-3.5 text-left whitespace-nowrap">Pengguna</th>
                    <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Divisi & Peran</th>
                    <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Tingkat Akses</th>
                    <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Diberikan Oleh</th>
                    <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((grant) => (
                    <tr
                      key={grant.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '10px 10px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{grant.user_name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{grant.user_email}</div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{grant.user_department || 'General'}</span>
                          <span className="badge badge-neutral font-mono" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                            {grant.user_role_id}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span
                          className={`badge ${grant.access_level === 'editor' ? 'badge-accent' : 'badge-neutral'}`}
                          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', display: 'inline-flex', whiteSpace: 'nowrap' }}
                        >
                          {grant.access_level === 'editor' ? 'Editor' : 'Viewer (Baca)'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{grant.granted_by_name || 'Admin'}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• {formatDateTime(grant.created_at, language, { dateStyle: 'short' })}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleRevoke(grant.user_id, grant.user_name)}
                          disabled={revokingUserId === grant.user_id}
                          className="btn btn-ghost-danger btn-xs"
                          title="Cabut hak akses pengguna ini"
                          style={{ padding: '4px 8px' }}
                        >
                          {revokingUserId === grant.user_id ? (
                            <Loader2 size={13} className="spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Grant Form Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3.5">
            <UserPlus size={16} className="text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0">
              Beri Akses Pengguna
            </h3>
          </div>

          <form onSubmit={handleGrant} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Pilih Pengguna
              </label>
              <EnterpriseSelect
                value={selectedUserId}
                onChange={(val) => setSelectedUserId(String(val))}
                options={allUsers.map((user) => {
                  const alreadyGranted = grantedUserIds.has(user.id);
                  return {
                    value: user.id,
                    label: `${user.name} (${user.email})`,
                    sublabel: `${user.department || 'General'}${alreadyGranted ? ' · [Sudah Memiliki Akses]' : ''}`,
                  };
                })}
                placeholder="-- Pilih Pengguna --"
                searchable={true}
                searchPlaceholder="Cari pengguna..."
                disabled={isSubmitting}
                size="sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tingkat Akses
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-2.5 text-xs cursor-pointer p-2.5 rounded-xl border transition-all ${
                    selectedLevel === 'viewer'
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value="viewer"
                    checked={selectedLevel === 'viewer'}
                    onChange={() => setSelectedLevel('viewer')}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Viewer (Hanya Baca & Tanya)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Dapat mencari dokumen, menanyakan via AI, dan membaca konten.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 text-xs cursor-pointer p-2.5 rounded-xl border transition-all ${
                    selectedLevel === 'editor'
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value="editor"
                    checked={selectedLevel === 'editor'}
                    onChange={() => setSelectedLevel('editor')}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Editor (Penuh)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Dapat mengedit kurasi insight, mengubah metadata, dan status dokumen.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              className="w-full h-8 px-4 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={13} />
                  <span>Simpan Hak Akses</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
