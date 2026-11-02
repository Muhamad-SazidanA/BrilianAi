'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CircleUser,
  Palette,
  BookOpen,
  LogOut,
  ChevronRight,
  ChevronsUpDown,
  Sun,
  Moon,
  Check,
  Globe,
  X,
  ShieldCheck,
  Cpu,
  Database,
  HelpCircle,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';

interface NavUserProps {
  user?: {
    name: string;
    email: string;
  };
  version?: string;
  isCollapsed?: boolean;
}

export default function NavUser({
  user = {
    name: 'Super Admin',
    email: 'superadmin@brilian.ai',
  },
  version = 'Brilian.Ai v1.0.0',
  isCollapsed = false,
}: NavUserProps) {
  const { language, setLanguage, t } = useLanguage();
  const { currentUser, logout } = useUserSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferencesSubmenu, setShowPreferencesSubmenu] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPass(false);
    setShowNewPass(false);
    setIsChangingPassword(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error(language === 'en' ? 'New password must be at least 8 characters long.' : 'Password baru minimal harus 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(language === 'en' ? 'New password and confirmation do not match.' : 'Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah password');
      }
      toast.success(t('user.password_changed_success'));
      setShowChangePasswordModal(false);
      resetPasswordForm();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const activeName = currentUser?.name || user.name;
  const activeEmail = currentUser?.email || user.email;

  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Collapsed User Hover Flyout State ──
  const [isFlyoutHovered, setIsFlyoutHovered] = useState(false);
  const [flyoutRect, setFlyoutRect] = useState<DOMRect | null>(null);
  const flyoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showUserFlyout = (e: React.MouseEvent<HTMLElement>) => {
    if (!isCollapsed || isOpen) return;
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutRect(rect);
    setIsFlyoutHovered(true);
  };

  const scheduleHideUserFlyout = () => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    flyoutTimeoutRef.current = setTimeout(() => {
      setIsFlyoutHovered(false);
    }, 120);
  };

  const cancelHideUserFlyout = () => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
  };

  // 1. Initialize and load saved theme preference (Default is ALWAYS light)
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme_preference') as 'light' | 'dark' | null;
      if (savedTheme === 'dark') {
        setThemeMode('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        setThemeMode('light');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch {
      // quiet fallback
    }
  }, []);

  // 2. Switch Theme (Light / Dark only, no Sistem)
  const handleSelectTheme = (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    try {
      localStorage.setItem('theme_preference', mode);
      document.documentElement.setAttribute('data-theme', mode);
    } catch {
      // quiet fallback
    }
    toast.success(mode === 'dark' ? t('user.toast_dark') : t('user.toast_light'));
  };

  // 3. Switch Language (Indonesia / English)
  const handleSelectLanguage = (lang: 'id' | 'en') => {
    setLanguage(lang);
    toast.success(lang === 'en' ? t('user.toast_lang_en') : t('user.toast_lang_id'));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowPreferencesSubmenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setShowLogoutDialog(false);
    setIsOpen(false);
    toast.success(t('user.toast_logout'));
    logout();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* ── User Trigger Button ──────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setIsFlyoutHovered(false);
          setIsOpen(!isOpen);
          setShowPreferencesSubmenu(false);
        }}
        onMouseEnter={showUserFlyout}
        onMouseLeave={scheduleHideUserFlyout}
        style={{
          width: isCollapsed ? '36px' : '100%',
          height: isCollapsed ? '36px' : undefined,
          margin: isCollapsed ? '0 auto' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: isCollapsed ? 0 : '7px',
          padding: isCollapsed ? 0 : '3px 6px',
          borderRadius: '8px',
          backgroundColor: isOpen ? 'var(--bg-subtle, #F1F5F9)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        className="hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-expanded={isOpen}
        title={undefined}
      >
        {/* Avatar Circle (Enlarged to 32px when collapsed) */}
        <UserAvatar name={activeName} size={isCollapsed ? 32 : 20} />

        {/* User name & email (hidden when collapsed) */}
        {!isCollapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: 'var(--text-primary, #0F172A)',
                  lineHeight: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeName}
              </div>
              <div
                style={{
                  fontSize: '9.5px',
                  color: 'var(--text-muted, #64748B)',
                  lineHeight: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeEmail}
              </div>
            </div>

            {/* ChevronsUpDown icon */}
            <ChevronsUpDown size={11} color="var(--text-secondary, #64748B)" style={{ flexShrink: 0 }} />
          </>
        )}
      </button>

      {/* ── Dropdown Popup Menu ───────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            left: isCollapsed ? '58px' : 'calc(var(--sidebar-width) + 6px)',
            bottom: '12px',
            width: 'fit-content',
            minWidth: '170px',
            maxWidth: '190px',
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderRadius: '10px',
            border: '1px solid var(--border-default, #E2E8F0)',
            boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1))',
            zIndex: 9999,
            padding: '4px',
          }}
        >
          {/* Header (Avatar + Name + Email) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
            }}
          >
            <UserAvatar name={activeName} size={28} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary, #0F172A)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: '15px',
                }}
              >
                {activeName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748B)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: '13px',
                }}
              >
                {activeEmail}
              </div>
            </div>
          </div>

          {/* Separator 1 */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-default, #F1F5F9)', margin: '3px 0' }} />

          {/* Item 1: Profil (Fully Functional Modal) */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowProfileModal(true);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '5px',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--text-primary, #0F172A)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <CircleUser size={14} strokeWidth={1.75} color="var(--text-secondary, #64748B)" />
            <span>{t('user.profile')}</span>
          </button>

          {/* Item 1b: Ganti Password */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowChangePasswordModal(true);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '5px',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--text-primary, #0F172A)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <KeyRound size={14} strokeWidth={1.75} color="var(--text-secondary, #64748B)" />
            <span>{t('user.change_password')}</span>
          </button>

          {/* Item 2: Preferensi (Tema & Bahasa) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowPreferencesSubmenu(!showPreferencesSubmenu)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '5px',
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-primary, #0F172A)',
                backgroundColor: showPreferencesSubmenu ? 'var(--bg-subtle, #F1F5F9)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.1s ease',
              }}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={14} strokeWidth={1.75} color="var(--text-secondary, #64748B)" />
                <span>{t('user.preferences')}</span>
              </div>
              <ChevronRight size={12} color="var(--text-secondary, #64748B)" />
            </button>

            {/* Submenu Preferensi (Tema: Terang/Gelap & Bahasa: ID/EN) */}
            {showPreferencesSubmenu && (
              <div
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 6px)',
                  bottom: '-20px',
                  width: '150px',
                  backgroundColor: 'var(--bg-card, #FFFFFF)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #E2E8F0)',
                  boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1))',
                  padding: '4px',
                  zIndex: 10000,
                }}
              >
                {/* ── TEMA SECTION (Terang & Gelap saja, default Terang) ── */}
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #64748B)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '4px 6px 2px',
                  }}
                >
                  {t('user.theme')}
                </div>
                {[
                  { id: 'light', label: t('user.theme_light'), icon: Sun },
                  { id: 'dark', label: t('user.theme_dark'), icon: Moon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = themeMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTheme(item.id as 'light' | 'dark')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 7px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 400,
                        border: 'none',
                        backgroundColor: isSelected ? 'var(--color-primary-subtle, #EFF6FF)' : 'transparent',
                        color: isSelected ? 'var(--color-primary, #2563EB)' : 'var(--text-primary, #0F172A)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      className="hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Icon size={13} />
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check size={12} strokeWidth={2.5} />}
                    </button>
                  );
                })}

                <div style={{ height: '1px', backgroundColor: 'var(--border-default, #F1F5F9)', margin: '4px 0' }} />

                {/* ── BAHASA SECTION (Indonesia & English) ── */}
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #64748B)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '3px 6px',
                  }}
                >
                  {t('user.language')}
                </div>
                {[
                  { id: 'id', label: t('user.lang_id') },
                  { id: 'en', label: t('user.lang_en') },
                ].map((l) => {
                  const isSelected = language === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleSelectLanguage(l.id as 'id' | 'en')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 7px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 400,
                        border: 'none',
                        backgroundColor: isSelected ? 'var(--color-primary-subtle, #EFF6FF)' : 'transparent',
                        color: isSelected ? 'var(--color-primary, #2563EB)' : 'var(--text-primary, #0F172A)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      className="hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <Globe size={13} />
                        <span>{l.label}</span>
                      </div>
                      {isSelected && <Check size={12} strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Item 3: Help Center (Opens Fumadocs /docs in new tab) */}
          <a
            href={language === 'id' ? '/docs/id/00-index' : '/docs/en/00-index'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '5px',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--text-primary, #0F172A)',
              backgroundColor: 'transparent',
              textDecoration: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
              boxSizing: 'border-box',
            }}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <BookOpen size={14} strokeWidth={1.75} color="var(--text-secondary, #64748B)" />
            <span>{t('user.help')}</span>
          </a>

          {/* Separator 3 */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-default, #F1F5F9)', margin: '3px 0' }} />

          {/* Item 4: Keluar */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowLogoutDialog(true);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '5px',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--color-danger, #EF4444)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut size={14} strokeWidth={1.75} color="var(--color-danger, #EF4444)" />
            <span>{t('user.logout')}</span>
          </button>

          {/* Separator 4 */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-default, #F1F5F9)', margin: '3px 0' }} />

          {/* Footer Version: Brilian.Ai v1.0.0 */}
          <div
            style={{
              padding: '4px 6px',
              fontSize: '10.5px',
              color: 'var(--text-muted, #64748B)',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {version}
          </div>
        </div>
      )}

      {/* ── MODAL 1: User Profile Modal ───────────────────────────── */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '16px',
              border: '1px solid var(--border-default, #E2E8F0)',
              boxShadow: 'var(--shadow-float, 0 20px 25px -5px rgba(0, 0, 0, 0.15))',
              padding: '1.75rem',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="btn btn-ghost btn-sm"
              style={{ position: 'absolute', right: '14px', top: '14px', padding: '6px' }}
            >
              <X size={16} />
            </button>

            {/* Profile Avatar & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.25rem' }}>
              <UserAvatar name={user.name} size="xl" />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {user.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user.email}</p>
              </div>
            </div>

            {/* Info Grid */}
            <div
              style={{
                backgroundColor: 'var(--bg-app, #F8FAFC)',
                borderRadius: '10px',
                border: '1px solid var(--border-default, #E2E8F0)',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="var(--color-primary)" />
                  {t('profile.role')}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.role_val')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} color="var(--color-success)" />
                  {t('profile.vision')}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.vision_val')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={14} color="var(--color-primary)" />
                  {t('profile.vector')}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('profile.vector_val')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('profile.status')}</span>
                <span className="badge badge-success" style={{ fontSize: '11px', padding: '1px 8px' }}>
                  {t('profile.status_val')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="btn btn-primary btn-sm"
              >
                {t('user.done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Change Password Modal ──────────────────────────── */}
      {showChangePasswordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
          }}
          onClick={() => {
            setShowChangePasswordModal(false);
            resetPasswordForm();
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '16px',
              border: '1px solid var(--border-default, #E2E8F0)',
              boxShadow: 'var(--shadow-float, 0 20px 25px -5px rgba(0, 0, 0, 0.15))',
              padding: '1.75rem',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowChangePasswordModal(false);
                resetPasswordForm();
              }}
              className="btn btn-ghost btn-sm"
              style={{ position: 'absolute', right: '14px', top: '14px', padding: '6px' }}
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-primary-subtle, #EFF6FF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary, #2563EB)',
                }}
              >
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('user.change_password')}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {t('user.change_password_desc')}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.25rem' }}>
                {/* Current Password */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #64748B)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('user.current_password')}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini (cth: admin123)"
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 36px 0 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default, #E2E8F0)',
                        fontSize: '12.5px',
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-app, #F8FAFC)',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '4px',
                      }}
                    >
                      {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #64748B)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('user.new_password')} <span style={{ color: 'var(--color-danger, #EF4444)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      required
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 36px 0 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default, #E2E8F0)',
                        fontSize: '12.5px',
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-app, #F8FAFC)',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '4px',
                      }}
                    >
                      {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary, #64748B)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('user.confirm_password')} <span style={{ color: 'var(--color-danger, #EF4444)' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    required
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-default, #E2E8F0)',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-app, #F8FAFC)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    resetPasswordForm();
                  }}
                  className="btn btn-outline btn-sm"
                  disabled={isChangingPassword}
                >
                  {t('user.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>{t('user.save_password')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Logout Dialog ─────────────────────────────────── */}
      {showLogoutDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
          }}
          onClick={() => setShowLogoutDialog(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '14px',
              border: '1px solid var(--border-default, #E2E8F0)',
              boxShadow: 'var(--shadow-float, 0 20px 25px -5px rgba(0, 0, 0, 0.15))',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0F172A)', marginBottom: '6px' }}>
              {t('user.logout_confirm_title')}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748B)', lineHeight: '20px', marginBottom: '1.25rem' }}>
              {t('user.logout_confirm_desc')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutDialog(false)}
                className="btn btn-outline btn-sm"
              >
                {t('user.cancel')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-primary btn-sm"
              >
                {t('user.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collapsed User Profile Flyout Card (Portal) ── */}
      {isCollapsed && isFlyoutHovered && !isOpen && flyoutRect && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: '12px',
            left: flyoutRect.right - 2,
            zIndex: 99999,
            paddingLeft: '10px',
            pointerEvents: 'auto',
          }}
          onMouseEnter={cancelHideUserFlyout}
          onMouseLeave={scheduleHideUserFlyout}
          onClick={() => {
            setIsFlyoutHovered(false);
            setIsOpen(true);
          }}
        >
          <div
            style={{
              minWidth: '190px',
              maxWidth: '240px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '10px',
              padding: '9px 12px',
              boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.16), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              cursor: 'pointer',
              animation: 'flyoutIn 0.14s cubic-bezier(0.16, 1, 0.3, 1)',
              backdropFilter: 'blur(8px)',
            }}
            className="sidebar-flyout-popover"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}
              >
                {language === 'en' ? 'USER PROFILE' : 'PROFIL PENGGUNA'}
              </span>
              <span
                className="badge badge-accent"
                style={{ fontSize: '9px', padding: '0 5px', height: '14px', lineHeight: '14px', borderRadius: '9999px' }}
              >
                {currentUser?.role?.name || currentUser?.role_id || 'User'}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '1px' }}>
              {activeName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeEmail}
            </div>
            <div
              style={{
                marginTop: '5px',
                paddingTop: '5px',
                borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 500 }}>
                {language === 'en' ? 'Click for settings' : 'Klik untuk menu akun'}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                ↵ Buka
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
