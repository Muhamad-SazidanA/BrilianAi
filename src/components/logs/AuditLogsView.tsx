'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Shield,
  Search,
  X,
  RefreshCw,
  Download,
  Eye,
  Check,
  Copy,
  User as UserIcon,
  Users,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Globe,
  FileText,
  Lock,
  Key,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  AuditLogEntry,
  ChatAuditLog,
  AuditCategory,
  AuditStatus,
  User,
} from '@/types/user';
import EnterprisePagination from '@/components/ui/EnterprisePagination';
import TableEmptyState, { TableLoadingState } from '@/components/ui/TableEmptyState';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

type CombinedAuditLog = AuditLogEntry & Partial<ChatAuditLog>;

/* ─── Shared micro icon-button ─────────────────────── */
function IBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
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
        color: 'var(--text-secondary)',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
        e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
        e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {children}
    </button>
  );
}

/* ─── Modal overlay ─────────────────────────────────── */
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

function fmtDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  } catch {
    return isoString;
  }
}

function fmtRelativeTime(isoString?: string, language: 'en' | 'id' = 'id'): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return language === 'en' ? 'just now' : 'baru saja';
    if (diffMin < 60) return language === 'en' ? `${diffMin}m ago` : `${diffMin}m lalu`;
    if (diffHour < 24) return language === 'en' ? `${diffHour}h ago` : `${diffHour}j lalu`;
    return language === 'en' ? `${diffDay}d ago` : `${diffDay}h lalu`;
  } catch {
    return '';
  }
}

export default function AuditLogsView() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<CombinedAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // User filter dropdown state
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userSearchInputRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Modal
  const [inspecting, setInspecting] = useState<CombinedAuditLog | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch users for filter dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.warn('Failed to load users for audit filter:', err);
      }
    };
    fetchUsers();
  }, []);

  // Handle click outside to close user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => userSearchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserDropdownOpen]);

  // Filtered users for search inside dropdown
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }, [users, userSearchQuery]);

  const selectedUser = useMemo(() => {
    if (selectedUserId === 'all') return null;
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  // Keyboard shortcut Ctrl+K and /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (selectedUserId !== 'all') params.set('userId', selectedUserId);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalLogs(data.total || 0);
      }
    } catch (err: any) {
      toast.error('Gagal memuat log audit: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, statusFilter, selectedUserId, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (selectedUserId !== 'all') params.set('userId', selectedUserId);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    window.open(`/api/audit-logs/export?${params.toString()}`, '_blank');
    toast.success(
      language === 'en' ? 'Downloading audit logs (CSV)...' : 'Mengunduh log audit (CSV)...'
    );
  };

  const copyPayloadJson = (data: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
      toast.success(language === 'en' ? 'Payload copied' : 'Payload berhasil disalin');
    } catch {
      toast.error('Failed to copy');
    }
  };

  /* ── Segmented Category Filter Options (Clean Text-Only matching /documents) ── */
  const SEGMENTS: { key: string; labelEn: string; labelId: string }[] = [
    { key: 'all', labelEn: 'All', labelId: 'Semua' },
    { key: 'AI_QUERY', labelEn: 'AI Chat', labelId: 'Tanya AI' },
    { key: 'DASHBOARD', labelEn: 'Dashboard', labelId: 'Dasbor' },
    { key: 'AUTH', labelEn: 'Auth', labelId: 'Autentikasi' },
    { key: 'DOC_MGMT', labelEn: 'Documents', labelId: 'Dokumen' },
    { key: 'USER_MGMT', labelEn: 'Users', labelId: 'Pengguna' },
    { key: 'ROLE_MGMT', labelEn: 'Roles', labelId: 'Peran' },
  ];

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
        {/* ── Unified Clean Header Controls (Matching /roles & /documents) ── */}
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
          {/* Left: Page Title + Inline Segmented Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.25,
                }}
              >
                {language === 'en' ? 'Audit Logs' : 'Audit Log'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {totalLogs} {language === 'en' ? 'events' : 'aktivitas'}
              </div>
            </div>

            {/* Segmented Filter Switcher (Smooth Text-Only Pill Style like /documents) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '9999px',
                padding: '2px',
                gap: '2px',
                height: '26px',
              }}
            >
              {SEGMENTS.map((seg) => {
                const isActive = categoryFilter === seg.key;
                return (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(seg.key);
                      setCurrentPage(1);
                    }}
                    style={{
                      borderRadius: '9999px',
                      padding: '2px 10px',
                      fontSize: '11px',
                      height: '22px',
                      fontWeight: isActive ? 600 : 500,
                      border: 'none',
                      backgroundColor: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: isActive ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {language === 'en' ? seg.labelEn : seg.labelId}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: User Filter Dropdown + Search + Refresh + Export */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* ── Searchable User Dropdown (Pill Style) ── */}
            <div ref={userDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setIsUserDropdownOpen((prev) => !prev);
                  setUserSearchQuery('');
                }}
                title={
                  selectedUser
                    ? `${language === 'en' ? 'Filtered by:' : 'Difilter berdasarkan:'} ${selectedUser.name}`
                    : language === 'en' ? 'Filter by user' : 'Filter berdasarkan pengguna'
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '26px',
                  padding: selectedUser ? '0 6px 0 8px' : '0 10px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: selectedUser ? 'var(--bg-subtle, #f1f5f9)' : 'var(--bg-card, #ffffff)',
                  color: selectedUser ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: selectedUser ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                  boxShadow: isUserDropdownOpen ? '0 0 0 2px rgba(15, 23, 42, 0.08)' : 'none',
                  maxWidth: '180px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                  e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = selectedUser ? 'var(--bg-subtle, #f1f5f9)' : 'var(--bg-card, #ffffff)';
                  e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
                }}
              >
                {selectedUser ? (
                  <>
                    <span
                      style={{
                        width: '15px',
                        height: '15px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                        color: 'var(--text-secondary, #475569)',
                        border: '1px solid var(--border-default, #e2e8f0)',
                        fontSize: '9px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '95px',
                      }}
                    >
                      {selectedUser.name}
                    </span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId('all');
                        setCurrentPage(1);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        marginLeft: '2px',
                      }}
                      title={language === 'en' ? 'Clear user filter' : 'Hapus filter pengguna'}
                    >
                      <X size={10} />
                    </span>
                  </>
                ) : (
                  <>
                    <UserIcon size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span>{language === 'en' ? 'All Users' : 'Semua Pengguna'}</span>
                    <ChevronDown size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </>
                )}
              </button>

              {/* Dropdown Popup Menu */}
              {isUserDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    right: 0,
                    width: '260px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
                    zIndex: 100,
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {/* Search Input inside Dropdown */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      borderRadius: '6px',
                      padding: '0 8px',
                      height: '28px',
                      gap: '6px',
                    }}
                  >
                    <Search size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <input
                      ref={userSearchInputRef}
                      type="text"
                      placeholder={language === 'en' ? 'Search user...' : 'Cari nama atau email...'}
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        padding: 0,
                        minWidth: 0,
                      }}
                    />
                    {userSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setUserSearchQuery('')}
                        style={{
                          display: 'flex',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: 0,
                        }}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>

                  {/* User Options List */}
                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1px',
                    }}
                  >
                    {/* Option: All Users */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId('all');
                        setCurrentPage(1);
                        setIsUserDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedUserId === 'all' ? 'var(--bg-subtle, #f1f5f9)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedUserId !== 'all') e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                      }}
                      onMouseLeave={(e) => {
                        if (selectedUserId !== 'all') e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: selectedUserId === 'all' ? 'var(--text-primary, #0f172a)' : 'var(--bg-subtle, #f1f5f9)',
                            color: selectedUserId === 'all' ? '#ffffff' : 'var(--text-secondary, #475569)',
                            border: selectedUserId === 'all' ? '1px solid var(--text-primary, #0f172a)' : '1px solid var(--border-default, #e2e8f0)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                          }}
                        >
                          <Users size={11} />
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: selectedUserId === 'all' ? 600 : 400,
                            color: selectedUserId === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {language === 'en' ? 'All Users' : 'Semua Pengguna'}
                        </span>
                      </div>
                      {selectedUserId === 'all' && <Check size={12} color="var(--text-primary, #0f172a)" />}
                    </button>

                    {/* Separator */}
                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #f1f5f9)', margin: '2px 0' }} />

                    {/* Filtered User List */}
                    {filteredUsers.length === 0 ? (
                      <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {language === 'en' ? 'No users found' : 'Pengguna tidak ditemukan'}
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelected = selectedUserId === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setCurrentPage(1);
                              setIsUserDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isSelected ? 'var(--bg-subtle, #f1f5f9)' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  backgroundColor: isSelected ? 'var(--text-primary, #0f172a)' : 'var(--bg-subtle, #f1f5f9)',
                                  color: isSelected ? '#ffffff' : 'var(--text-secondary, #475569)',
                                  border: isSelected ? '1px solid var(--text-primary, #0f172a)' : '1px solid var(--border-default, #e2e8f0)',
                                  fontSize: '9.5px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                <span
                                  style={{
                                    fontSize: '11.5px',
                                    fontWeight: isSelected ? 600 : 500,
                                    color: 'var(--text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={u.name}
                                >
                                  {u.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={u.email}
                                >
                                  {u.email}
                                </span>
                              </div>
                            </div>
                            {isSelected && <Check size={12} color="var(--text-primary, #0f172a)" style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Search Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '9999px',
                padding: '0 8px 0 10px',
                height: '26px',
                width: '210px',
                gap: '6px',
              }}
            >
              <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={language === 'en' ? 'Search event, actor...' : 'Cari event atau aktor...'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  style={{
                    display: 'flex',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                  }}
                >
                  <X size={11} />
                </button>
              ) : (
                <kbd
                  className="kbd-shortcut"
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '9999px',
                    flexShrink: 0,
                  }}
                >
                  Ctrl K
                </kbd>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchLogs}
              disabled={isLoading}
              title={language === 'en' ? 'Refresh' : 'Segarkan'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '9999px',
                border: '1px solid var(--border-default, #e2e8f0)',
                backgroundColor: 'var(--bg-card, #ffffff)',
                cursor: isLoading ? 'default' : 'pointer',
                color: 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
              }}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExport}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0f172a';
              }}
            >
              <Download size={11} strokeWidth={2.4} />
              <span>{language === 'en' ? 'Export CSV' : 'Ekspor CSV'}</span>
            </button>
          </div>
        </div>

        {/* ── Table Content (Slim & Clean 5-Column Format matching /roles) ── */}
        <div className="enterprise-table-wrapper">
          <table
            className={isLoading ? 'table-loading' : logs.length === 0 ? 'table-empty' : ''}
            style={{
              width: '100%',
              minWidth: '780px',
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: '12.5px',
            }}
          >
            <thead>
              <tr>
                {[
                  { label: language === 'en' ? 'Timestamp' : 'Waktu', width: '19%', align: 'left' },
                  { label: language === 'en' ? 'Actor' : 'Aktor', width: '21%', align: 'left' },
                  { label: language === 'en' ? 'Activity' : 'Aktivitas', width: '24%', align: 'left' },
                  { label: language === 'en' ? 'Target / Resource' : 'Target / Sumber Daya', width: '20%', align: 'left' },
                  { label: language === 'en' ? 'Status & Action' : 'Status & Aksi', width: '16%', align: 'center' },
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
                      textAlign: (col.align as any) || 'left',
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
                  <td colSpan={5}>
                    <TableLoadingState
                      message={language === 'en' ? 'Loading audit records...' : 'Memuat data audit...'}
                    />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <TableEmptyState
                      icon={Shield}
                      title={
                        searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || selectedUserId !== 'all'
                          ? language === 'en'
                            ? 'No matching audit events'
                            : 'Tidak ada aktivitas audit yang cocok'
                          : language === 'en'
                          ? 'No audit events recorded'
                          : 'Belum ada aktivitas audit'
                      }
                      description={
                        language === 'en'
                          ? 'Try adjusting your search keyword, category, or user filter above.'
                          : 'Coba sesuaikan kata kunci pencarian, kategori, atau filter pengguna di atas.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actorName = log.actor_name || log.user_name || 'Anonymous';
                  const actorSub = log.actor_department || log.user_department || log.actor_email || '';
                  const resourceName = log.resource_name || log.topic || log.query_text || '-';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* 1. Timestamp */}
                      <td style={{ padding: '8px 14px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 500,
                              fontFamily: 'var(--font-mono, monospace)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {fmtDateTime(log.created_at)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            ({fmtRelativeTime(log.created_at, language)})
                          </span>
                        </div>
                      </td>

                      {/* 2. Actor / Identity */}
                      <td style={{ padding: '8px 14px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '180px' }}>
                          <span
                            style={{
                              fontWeight: 500,
                              fontSize: '12.5px',
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={actorName}
                          >
                            {actorName}
                          </span>
                          {actorSub && actorSub !== '-' && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={actorSub}
                            >
                              {actorSub}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Activity (Category + Action) */}
                      <td style={{ padding: '8px 14px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: log.event_category === 'DASHBOARD'
                                ? 'rgba(99, 102, 241, 0.08)'
                                : log.event_category === 'AI_QUERY'
                                ? 'rgba(14, 165, 233, 0.08)'
                                : 'var(--bg-subtle, #f1f5f9)',
                              border: log.event_category === 'DASHBOARD'
                                ? '1px solid rgba(99, 102, 241, 0.25)'
                                : log.event_category === 'AI_QUERY'
                                ? '1px solid rgba(14, 165, 233, 0.25)'
                                : '1px solid var(--border-default, #e2e8f0)',
                              color: log.event_category === 'DASHBOARD'
                                ? '#4f46e5'
                                : log.event_category === 'AI_QUERY'
                                ? '#0284c7'
                                : 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {log.event_category || 'SYSTEM'}
                          </span>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontFamily: 'var(--font-mono, monospace)',
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {log.action}
                          </span>
                        </div>
                      </td>

                      {/* 4. Target / Resource */}
                      <td style={{ padding: '8px 14px', textAlign: 'left', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, maxWidth: '240px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={resourceName}
                          >
                            {resourceName}
                          </span>
                          {log.resource_type && (
                            <span
                              style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                padding: '0 4px',
                                borderRadius: '3px',
                                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                                border: '1px solid var(--border-subtle, #f1f5f9)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {log.resource_type.toLowerCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Status & Action Combined */}
                      <td style={{ padding: '8px 14px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4.5px',
                              padding: '2.5px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 500,
                              backgroundColor:
                                log.status === 'failed'
                                  ? '#fef2f2'
                                  : log.status === 'warning'
                                  ? '#fffbeb'
                                  : '#f0fdf4',
                              border:
                                log.status === 'failed'
                                  ? '1px solid #fecaca'
                                  : log.status === 'warning'
                                  ? '1px solid #fde68a'
                                  : '1px solid #bbf7d0',
                              color:
                                log.status === 'failed'
                                  ? '#b91c1c'
                                  : log.status === 'warning'
                                  ? '#b45309'
                                  : '#15803d',
                            }}
                          >
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                backgroundColor:
                                  log.status === 'failed'
                                    ? '#dc2626'
                                    : log.status === 'warning'
                                    ? '#d97706'
                                    : '#16a34a',
                              }}
                            />
                            {log.status === 'failed'
                              ? language === 'en'
                                ? 'Failed'
                                : 'Gagal'
                              : log.status === 'warning'
                              ? language === 'en'
                                ? 'Warning'
                                : 'Peringatan'
                              : language === 'en'
                              ? 'Success'
                              : 'Berhasil'}
                          </span>

                          <button
                            type="button"
                            title={language === 'en' ? 'View event details' : 'Lihat detail log audit'}
                            onClick={() => setInspecting(log)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              height: '24px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-default, #e2e8f0)',
                              backgroundColor: 'var(--bg-card, #ffffff)',
                              color: 'var(--text-secondary, #475569)',
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                              e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
                              e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
                              e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
                              e.currentTarget.style.color = 'var(--text-secondary, #475569)';
                            }}
                          >
                            <Eye size={12} />
                            <span>{language === 'en' ? 'Detail' : 'Detail'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Enterprise Pagination Bar (Pinned at bottom) ── */}
        <EnterprisePagination
          currentPage={currentPage}
          totalItems={totalLogs}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          language={language}
        />
      </div>

      {/* ════ MODAL: Detail Event Audit ════ */}
      {inspecting && (
        <div style={OL} onClick={() => setInspecting(null)}>
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '720px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {inspecting.event_category || 'SYSTEM'}
                  </span>
                  <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inspecting.action}
                  </span>

                  {/* Status Pill Badge with Icon */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor:
                        inspecting.status === 'failed'
                          ? '#fef2f2'
                          : inspecting.status === 'warning'
                          ? '#fffbeb'
                          : '#f0fdf4',
                      border:
                        inspecting.status === 'failed'
                          ? '1px solid #fecaca'
                          : inspecting.status === 'warning'
                          ? '1px solid #fde68a'
                          : '1px solid #bbf7d0',
                      color:
                        inspecting.status === 'failed'
                          ? '#b91c1c'
                          : inspecting.status === 'warning'
                          ? '#b45309'
                          : '#15803d',
                    }}
                  >
                    {inspecting.status === 'failed' ? (
                      <XCircle size={12} strokeWidth={2.4} />
                    ) : inspecting.status === 'warning' ? (
                      <AlertTriangle size={12} strokeWidth={2.4} />
                    ) : (
                      <CheckCircle2 size={12} strokeWidth={2.4} />
                    )}
                    {inspecting.status === 'failed'
                      ? language === 'en'
                        ? 'Failed'
                        : 'Gagal'
                      : inspecting.status === 'warning'
                      ? language === 'en'
                        ? 'Warning'
                        : 'Peringatan'
                      : language === 'en'
                      ? 'Success'
                      : 'Berhasil'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {fmtDateTime(inspecting.created_at)} ({fmtRelativeTime(inspecting.created_at, language)}) • ID: {inspecting.id}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => copyPayloadJson(inspecting)}
                  title={language === 'en' ? 'Copy payload' : 'Salin payload'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '26px',
                    padding: '0 8px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {copiedJson ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                  <span>{copiedJson ? (language === 'en' ? 'Copied' : 'Tersalin') : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspecting(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: '1 1 auto',
                minHeight: 0,
                overflowY: 'auto',
                padding: '1.25rem 1.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Failure Alert Banner (if event failed) */}
              {inspecting.status === 'failed' && (inspecting.details?.error || inspecting.details?.reason || inspecting.details?.message) && (
                <div
                  style={{
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#991b1b',
                    fontSize: '12px',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                      {language === 'en' ? 'Failure Reason' : 'Penyebab Kegagalan'}
                    </div>
                    <div style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {inspecting.details?.error || inspecting.details?.reason || inspecting.details?.message}
                    </div>
                  </div>
                </div>
              )}

              {/* 2x2 Structured Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', flexShrink: 0 }}>
                {/* 1. Actor */}
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    <UserIcon size={11} />
                    <span>{language === 'en' ? 'ACTOR / IDENTITY' : 'AKTOR / PENGGUNA'}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {inspecting.actor_name || inspecting.user_name || 'System'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                    {inspecting.actor_email || inspecting.user_email || 'system@brilian.ai'}
                  </div>
                </div>

                {/* 2. Department & IP */}
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    <Building2 size={11} />
                    <span>{language === 'en' ? 'DEPARTMENT & IP' : 'DEPARTEMEN & IP'}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {inspecting.actor_department || inspecting.user_department || 'General'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>
                    IP: {inspecting.actor_ip || 'Internal / Localhost'}
                  </div>
                </div>

                {/* 3. Target / Resource */}
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    <Layers size={11} />
                    <span>{language === 'en' ? 'TARGET / RESOURCE' : 'TARGET / SUMBER DAYA'}</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }} title={inspecting.resource_name || inspecting.topic || inspecting.query_text || '—'}>
                    {inspecting.resource_name || inspecting.topic || inspecting.query_text || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {language === 'en' ? 'Type' : 'Tipe'}: {inspecting.resource_type || 'system'}
                  </div>
                </div>

                {/* 4. Timestamp */}
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    <Clock size={11} />
                    <span>{language === 'en' ? 'TIMESTAMP' : 'WAKTU EKSEKUSI'}</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>
                    {fmtDateTime(inspecting.created_at)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {fmtRelativeTime(inspecting.created_at, language)}
                  </div>
                </div>
              </div>

              {/* ── Category Specific Cards ── */}

              {/* 1. AUTH Specific Card */}
              {(inspecting.event_category === 'AUTH' || inspecting.action.startsWith('auth.')) && (
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Lock size={12} color="var(--text-secondary)" />
                    <span>{language === 'en' ? 'Authentication Details' : 'Rincian Autentikasi & Sesi'}</span>
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Method' : 'Metode Autentikasi'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {inspecting.details?.auth_provider || (inspecting.action.includes('google') ? 'Google OAuth 2.0' : 'Email & Password')}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Result' : 'Hasil Verifikasi'}
                      </span>
                      <span style={{ fontWeight: 600, color: inspecting.status === 'success' ? '#15803d' : '#b91c1c' }}>
                        {inspecting.status === 'success'
                          ? language === 'en' ? 'Session Authenticated' : 'Berhasil Terautentikasi'
                          : inspecting.details?.reason || (language === 'en' ? 'Invalid credentials' : 'Kredensial tidak valid')}
                      </span>
                    </div>
                    {inspecting.details?.role && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                          {language === 'en' ? 'Assigned Role' : 'Role Pengguna'}
                        </span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {inspecting.details.role}
                        </span>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Account Email' : 'Email Akun'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px' }}>
                        {inspecting.actor_email || inspecting.resource_name || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. DOC_MGMT Specific Card */}
              {(inspecting.event_category === 'DOC_MGMT' || inspecting.action.startsWith('document.')) && (
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileText size={13} color="var(--text-secondary)" />
                    <span>{language === 'en' ? 'Document Management Details' : 'Rincian Operasi Dokumen'}</span>
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Document Name' : 'Nama Dokumen'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-all', display: 'block' }}>
                        {inspecting.resource_name || inspecting.details?.filename || inspecting.details?.original_filename || 'Dokumen'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Classification' : 'Klasifikasi Keamanan'}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                          border: '1px solid var(--border-default, #e2e8f0)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {inspecting.details?.classification || 'Internal'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Operation Type' : 'Jenis Operasi'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {inspecting.action === 'document.upload'
                          ? (language === 'en' ? 'Document Upload & Ingestion' : 'Unggah & Ingestion Dokumen')
                          : inspecting.action === 'document.activate'
                          ? (language === 'en' ? 'Activate for AI Knowledge' : 'Aktivasi ke Basis Pengetahuan AI')
                          : inspecting.action === 'document.deactivate'
                          ? (language === 'en' ? 'Deactivate from AI Knowledge' : 'Nonaktifkan dari Chatbot')
                          : inspecting.action === 'document.delete'
                          ? (language === 'en' ? 'Permanent Deletion' : 'Penghapusan Berkas')
                          : inspecting.action === 'document.update'
                          ? (language === 'en' ? 'Metadata Update' : 'Pembaruan Metadata')
                          : inspecting.action}
                      </span>
                    </div>
                    {inspecting.details?.page_count !== undefined && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                          {language === 'en' ? 'Pages & Chunks' : 'Halaman & Chunks'}
                        </span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {inspecting.details.page_count} {language === 'en' ? 'Pages' : 'Hal'} • {inspecting.details.chunk_count || 0} Chunks
                        </span>
                      </div>
                    )}
                    {inspecting.details?.division_id && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                          {language === 'en' ? 'Division' : 'Divisi'}
                        </span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {inspecting.details.division_id}
                        </span>
                      </div>
                    )}
                    {inspecting.details?.is_active_knowledge !== undefined && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                          {language === 'en' ? 'AI Knowledge Status' : 'Status Basis Pengetahuan AI'}
                        </span>
                        <span style={{ fontWeight: 600, color: inspecting.details.is_active_knowledge ? '#15803d' : 'var(--text-muted)' }}>
                          {inspecting.details.is_active_knowledge ? 'Aktif di Chatbot' : 'Nonaktif'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. USER_MGMT Specific Card */}
              {(inspecting.event_category === 'USER_MGMT' || inspecting.action.startsWith('user.')) && (
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <UserIcon size={12} color="var(--text-secondary)" />
                    <span>{language === 'en' ? 'User Administration Details' : 'Rincian Administrasi Pengguna'}</span>
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Target User' : 'Target Pengguna'}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {inspecting.resource_name || inspecting.details?.name || '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Role' : 'Peran (Role)'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {inspecting.details?.role || inspecting.details?.role_id || '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Department' : 'Departemen'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {inspecting.details?.department || '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Account Status' : 'Status Akun'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {inspecting.details?.status || 'Aktif'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ROLE_MGMT Specific Card */}
              {(inspecting.event_category === 'ROLE_MGMT' || inspecting.action.startsWith('role.')) && (
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Key size={12} color="var(--text-secondary)" />
                    <span>{language === 'en' ? 'Role & Permission Details' : 'Rincian Hak Akses & Peran'}</span>
                  </div>
                  <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Role Name' : 'Nama Role'}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {inspecting.resource_name || inspecting.resource_id}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        {language === 'en' ? 'Permissions Count' : 'Total Cakupan Izin'}
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {inspecting.details?.permissions_count ?? '—'} {language === 'en' ? 'permissions' : 'izin'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Specific Content if AI Query ONLY */}
              {(inspecting.event_category === 'AI_QUERY' || inspecting.action === 'chat.inquiry') &&
                Boolean(inspecting.details?.query_text || (inspecting.query_text && inspecting.query_text !== inspecting.resource_name && inspecting.query_text !== inspecting.action)) && (
                <>
                  <div
                    style={{
                      border: '1px solid var(--border-default, #e2e8f0)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '7px 12px',
                        backgroundColor: 'var(--bg-subtle, #f8fafc)',
                        borderBottom: '1px solid var(--border-default, #e2e8f0)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {language === 'en' ? 'User Question' : 'Pertanyaan Pengguna'}
                    </div>
                    <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {inspecting.details?.query_text || inspecting.query_text}
                    </div>
                  </div>

                  {(inspecting.answer_excerpt || inspecting.details?.answer_excerpt) && (
                    <div
                      style={{
                        border: '1px solid var(--border-default, #e2e8f0)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-card, #ffffff)',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '7px 12px',
                          backgroundColor: 'var(--bg-subtle, #f8fafc)',
                          borderBottom: '1px solid var(--border-default, #e2e8f0)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {language === 'en' ? 'AI Answer Preview' : 'Cuplikan Jawaban AI'}
                      </div>
                      <div
                        style={{
                          padding: '10px 12px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                          maxHeight: '160px',
                          overflowY: 'auto',
                        }}
                      >
                        <MarkdownContent
                          content={inspecting.answer_excerpt || inspecting.details?.answer_excerpt}
                        />
                      </div>
                    </div>
                  )}

                  {Array.isArray(inspecting.sources_used || inspecting.details?.sources_used) &&
                    (inspecting.sources_used || inspecting.details?.sources_used).length > 0 && (
                      <div
                        style={{
                          border: '1px solid var(--border-default, #e2e8f0)',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            padding: '7px 12px',
                            backgroundColor: 'var(--bg-subtle, #f8fafc)',
                            borderBottom: '1px solid var(--border-default, #e2e8f0)',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {language === 'en' ? 'Referenced Sources' : 'Sumber Referensi'} (
                          {(inspecting.sources_used || inspecting.details?.sources_used).length})
                        </div>
                        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(inspecting.sources_used || inspecting.details?.sources_used).map(
                            (s: any, idx: number) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                }}
                              >
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {s.filename || 'Dokumen'}
                                </span>
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono, monospace)',
                                    color: 'var(--text-muted)',
                                    fontSize: '11px',
                                  }}
                                >
                                  hal. {s.pageStart || 1}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </>
              )}

              {/* Raw Payload JSON */}
              <div
                style={{
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '7px 12px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    borderBottom: '1px solid var(--border-default, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Payload Data
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    JSON
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '12px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    overflow: 'auto',
                    maxHeight: '220px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(inspecting.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.85rem 1.4rem',
                borderTop: '1px solid var(--border-default, #e2e8f0)',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setInspecting(null)}
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
                {language === 'en' ? 'Close' : 'Tutup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
