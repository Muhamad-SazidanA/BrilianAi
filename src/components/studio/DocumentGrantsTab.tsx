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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      {/* Information Banner */}
      <div
        className="ui-card"
        style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-subtle)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Info size={18} style={{ color: 'var(--text-secondary)', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
            Kebijakan Hak Akses Dokumen Khusus (User Whitelist)
          </strong>
          Dokumen ini secara default dilindungi oleh klasifikasi kerahasiaan dan divisi. Anda dapat menambahkan pengguna tertentu ke dalam daftar izin di bawah ini untuk memberi mereka hak akses langsung, meskipun jabatan atau divisinya tidak mencakup dokumen ini.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Table of Active Grants */}
        <div className="ui-card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} style={{ color: 'var(--text-secondary)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Pengguna dengan Akses Khusus ({grants.length})
              </h3>
            </div>
            {isLoading && <Loader2 size={15} className="spin" style={{ color: 'var(--text-secondary)' }} />}
          </div>

          {isLoading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Loader2 size={20} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              Memuat daftar izin pengguna...
            </div>
          ) : grants.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-default)',
              }}
            >
              <Shield size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Belum ada pengguna khusus
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto' }}>
                Dokumen hanya dapat diakses sesuai batasan Divisi dan Klasifikasi standar. Gunakan formulir di samping untuk menambahkan akses khusus.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Pengguna</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Divisi & Peran</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Tingkat Akses</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600 }}>Diberikan Oleh</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
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
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{grant.user_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{grant.user_email}</div>
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{grant.user_department || 'General'}</div>
                        <span className="badge badge-neutral font-mono" style={{ fontSize: '10px', marginTop: '2px' }}>
                          {grant.user_role_id}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span
                          className={`badge ${grant.access_level === 'editor' ? 'badge-accent' : 'badge-neutral'}`}
                          style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}
                        >
                          {grant.access_level === 'editor' ? 'Editor' : 'Viewer (Baca)'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        <div>{grant.granted_by_name || 'Admin'}</div>
                        <div style={{ fontSize: '10.5px' }}>
                          {formatDateTime(grant.created_at, language, { dateStyle: 'short' })}
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
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
        <div
          className="ui-card"
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <UserPlus size={16} style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Beri Akses Pengguna
            </h3>
          </div>

          <form onSubmit={handleGrant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
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
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Tingkat Akses
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedLevel === 'viewer' ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: selectedLevel === 'viewer' ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value="viewer"
                    checked={selectedLevel === 'viewer'}
                    onChange={() => setSelectedLevel('viewer')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Viewer (Hanya Baca & Tanya)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Dapat mencari dokumen, menanyakan via AI, dan membaca konten.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: selectedLevel === 'editor' ? '1px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: selectedLevel === 'editor' ? 'var(--bg-subtle)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value="editor"
                    checked={selectedLevel === 'editor'}
                    onChange={() => setSelectedLevel('editor')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Editor (Penuh)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Dapat mengedit kurasi insight, mengubah metadata, dan status dokumen.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              className="btn btn-primary btn-sm"
              style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
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
