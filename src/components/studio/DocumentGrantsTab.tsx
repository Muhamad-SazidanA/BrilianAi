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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.25rem' }}>
      {/* Information Banner */}
      <div
        style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <Info size={18} style={{ color: 'var(--color-primary, #2563eb)', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
            Kebijakan Hak Akses Dokumen Khusus (User Whitelist)
          </strong>
          Dokumen ini secara default dilindungi oleh klasifikasi kerahasiaan dan divisi. Anda dapat menambahkan pengguna tertentu ke dalam daftar izin di bawah ini untuk memberi mereka hak akses langsung, meskipun jabatan atau divisinya tidak mencakup dokumen ini.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem', alignItems: 'flex-start' }}>
        {/* Table of Active Grants */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg, 12px)',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-default, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} style={{ color: 'var(--color-primary, #2563eb)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                Pengguna dengan Akses Khusus
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
                ({grants.length})
              </span>
            </div>
            {isLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />}
          </div>

          {isLoading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              Memuat daftar izin pengguna...
            </div>
          ) : grants.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                borderRadius: 'var(--radius-md, 10px)',
                border: '1px dashed var(--border-default, #e2e8f0)',
              }}
            >
              <Shield size={24} style={{ color: 'var(--text-muted, #94a3b8)', margin: '0 auto 8px', display: 'block' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: '4px' }}>
                Belum ada pengguna khusus
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', maxWidth: '380px', margin: '0 auto' }}>
                Dokumen hanya dapat diakses sesuai batasan Divisi dan Klasifikasi standar. Gunakan formulir di samping untuk menambahkan akses khusus.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default, #e2e8f0)', color: 'var(--text-secondary, #64748b)' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pengguna</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Divisi & Peran</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tingkat Akses</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Diberikan Oleh</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((grant) => (
                    <tr
                      key={grant.id}
                      style={{
                        borderBottom: '1px solid var(--border-default, #f1f5f9)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                              color: 'var(--text-primary, #0f172a)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 600,
                              flexShrink: 0,
                              border: '1px solid var(--border-default, #e2e8f0)',
                            }}
                          >
                            {(grant.user_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{grant.user_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>{grant.user_email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: '12px' }}>{grant.user_department || 'General'}</div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                            color: 'var(--text-secondary, #64748b)',
                            border: '1px solid var(--border-default, #e2e8f0)',
                            display: 'inline-block',
                            marginTop: '2px',
                          }}
                        >
                          {grant.user_role_id}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor:
                              grant.access_level === 'editor'
                                ? 'var(--color-primary-subtle, #eff6ff)'
                                : 'var(--bg-subtle, #f1f5f9)',
                            color:
                              grant.access_level === 'editor'
                                ? 'var(--color-primary, #2563eb)'
                                : 'var(--text-secondary, #64748b)',
                            border: `1px solid ${
                              grant.access_level === 'editor'
                                ? 'var(--color-primary-border, #bfdbfe)'
                                : 'var(--border-default, #e2e8f0)'
                            }`,
                          }}
                        >
                          {grant.access_level === 'editor' ? 'Editor' : 'Viewer (Baca)'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: '11.5px', color: 'var(--text-muted, #94a3b8)' }}>
                        <div style={{ color: 'var(--text-secondary, #64748b)' }}>{grant.granted_by_name || 'Admin'}</div>
                        <div style={{ fontSize: '10.5px' }}>
                          {formatDateTime(grant.created_at, language, { dateStyle: 'short' })}
                        </div>
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleRevoke(grant.user_id, grant.user_name)}
                          disabled={revokingUserId === grant.user_id}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted, #94a3b8)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          title="Cabut hak akses pengguna ini"
                        >
                          {revokingUserId === grant.user_id ? (
                            <Loader2 size={13} className="animate-spin" />
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
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg, 12px)',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-default, #e2e8f0)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <UserPlus size={15} style={{ color: 'var(--color-primary, #2563eb)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              Beri Akses Pengguna
            </h3>
          </div>

          <form onSubmit={handleGrant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #64748b)',
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
                    label: user.name,
                    sublabel: user.email,
                    badge: alreadyGranted ? 'Akses Aktif' : user.department || 'General',
                    disabled: alreadyGranted,
                    icon: (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                          color: 'var(--text-primary, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 600,
                          flexShrink: 0,
                          border: '1px solid var(--border-default, #e2e8f0)',
                        }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    ),
                  };
                })}
                placeholder="-- Pilih Pengguna --"
                searchable={true}
                searchPlaceholder="Cari nama atau email pengguna..."
                size="md"
                buttonHeight="36px"
                menuMaxHeight={260}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary, #64748b)',
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
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: selectedLevel === 'viewer' ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--border-default, #e2e8f0)',
                    backgroundColor: selectedLevel === 'viewer' ? 'var(--color-primary-subtle, #eff6ff)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value="viewer"
                    checked={selectedLevel === 'viewer'}
                    onChange={() => setSelectedLevel('viewer')}
                    style={{ marginTop: '2px', accentColor: 'var(--color-primary, #2563eb)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>Viewer (Hanya Baca & Tanya)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginTop: '1px' }}>
                      Dapat mencari dokumen, menanyakan via AI Chat, dan membaca konten.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: selectedLevel === 'editor' ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--border-default, #e2e8f0)',
                    backgroundColor: selectedLevel === 'editor' ? 'var(--color-primary-subtle, #eff6ff)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="accessLevel"
                    value="editor"
                    checked={selectedLevel === 'editor'}
                    onChange={() => setSelectedLevel('editor')}
                    style={{ marginTop: '2px', accentColor: 'var(--color-primary, #2563eb)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>Editor (Penuh)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', marginTop: '1px' }}>
                      Dapat mengedit kurasi insight, mengubah metadata, dan status dokumen.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              style={{
                width: '100%',
                marginTop: '0.25rem',
                height: '34px',
                borderRadius: '9999px',
                backgroundColor: selectedUserId ? 'var(--text-primary, #0f172a)' : 'var(--bg-subtle, #f1f5f9)',
                color: selectedUserId ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isSubmitting || !selectedUserId ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="spin" />
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
