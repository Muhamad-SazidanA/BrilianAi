'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Users,
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
    name: 'Admin',
    email: 'admin@brilian.ai',
  },
  version = 'Brilian.Ai v1.0.0',
  isCollapsed = false,
}: NavUserProps) {
  const { language, setLanguage, t } = useLanguage();
  const { currentUser, allUsers, switchUser } = useUserSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferencesSubmenu, setShowPreferencesSubmenu] = useState(false);
  const [showSwitchUserSubmenu, setShowSwitchUserSubmenu] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const activeName = currentUser?.name || user.name;
  const activeEmail = currentUser?.email || user.email;
  const activeColor = currentUser?.avatar_color || '#2563EB';

  const containerRef = useRef<HTMLDivElement | null>(null);

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
        setShowSwitchUserSubmenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setShowLogoutDialog(false);
    setIsOpen(false);
    toast.success(t('user.toast_logout'));
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* ── User Trigger Button ──────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowPreferencesSubmenu(false);
          setShowSwitchUserSubmenu(false);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap: isCollapsed ? 0 : '10px',
          padding: isCollapsed ? '6px 0' : '8px 10px',
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
        title={isCollapsed ? `${activeName} (${activeEmail})` : undefined}
      >
        {/* Avatar Circle (Standard Neutral Spensify Avatar) */}
        <UserAvatar name={activeName} size={34} />

        {/* User name & email (hidden when collapsed) */}
        {!isCollapsed && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #0F172A)',
                  lineHeight: '18px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeName}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted, #64748B)',
                  lineHeight: '16px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeEmail}
              </div>
            </div>

            {/* ChevronsUpDown icon */}
            <ChevronsUpDown size={16} color="var(--text-secondary, #64748B)" style={{ flexShrink: 0 }} />
          </>
        )}
      </button>

      {/* ── Dropdown Popup Menu ───────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            left: isCollapsed ? '80px' : 'calc(var(--sidebar-width) + 6px)',
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
                  fontSize: '12.5px',
                  fontWeight: 600,
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

          {/* Item 1b: Ganti Akun Demo (Switch User) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => {
                setShowSwitchUserSubmenu(!showSwitchUserSubmenu);
                setShowPreferencesSubmenu(false);
              }}
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
                backgroundColor: showSwitchUserSubmenu ? 'var(--bg-subtle, #F1F5F9)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.1s ease',
              }}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={14} strokeWidth={1.75} color="var(--text-secondary, #64748B)" />
                <span>{language === 'en' ? 'Switch User' : 'Ganti Akun'}</span>
              </div>
              <ChevronRight size={12} color="var(--text-secondary, #64748B)" />
            </button>

            {/* Submenu Switch User */}
            {showSwitchUserSubmenu && (
              <div
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 6px)',
                  bottom: '-30px',
                  width: '210px',
                  backgroundColor: 'var(--bg-card, #FFFFFF)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #E2E8F0)',
                  boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1))',
                  padding: '4px',
                  zIndex: 10000,
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {language === 'en' ? 'Select User' : 'Pilih Akun Demo'}
                </div>
                {allUsers.map((u) => {
                  const isCurrent = (currentUser?.id || '') === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchUser(u.id);
                        setShowSwitchUserSubmenu(false);
                        setIsOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: isCurrent ? 'var(--color-primary-subtle, #EFF6FF)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: '6px',
                      }}
                      className="hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <UserAvatar name={u.name} size={18} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isCurrent ? 600 : 400 }}>
                          {u.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {u.role_id}
                        </span>
                        {isCurrent && <Check size={12} color="var(--color-primary, #2563EB)" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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

          {/* Item 3: Help Center (Fully Functional Modal) */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowHelpModal(true);
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
            <BookOpen size={14} strokeWidth={1.75} color="var(--text-secondary, #64748B)" />
            <span>{t('user.help')}</span>
          </button>

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

      {/* ── MODAL 2: Help Center Modal ─────────────────────────────── */}
      {showHelpModal && (
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
          onClick={() => setShowHelpModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '16px',
              border: '1px solid var(--border-default, #E2E8F0)',
              boxShadow: 'var(--shadow-float, 0 20px 25px -5px rgba(0, 0, 0, 0.15))',
              padding: '1.75rem',
              position: 'relative',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="btn btn-ghost btn-sm"
              style={{ position: 'absolute', right: '14px', top: '14px', padding: '6px' }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-primary-subtle, #EFF6FF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary, #2563EB)',
                }}
              >
                <HelpCircle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('help.title')}
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  {t('help.subtitle')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
              {/* Step 1 */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-app, #F8FAFC)',
                  border: '1px solid var(--border-default, #E2E8F0)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {t('help.step1_title')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '18px' }}>
                  {t('help.step1_desc')}
                </div>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-app, #F8FAFC)',
                  border: '1px solid var(--border-default, #E2E8F0)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {t('help.step2_title')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '18px' }}>
                  {t('help.step2_desc')}
                </div>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-app, #F8FAFC)',
                  border: '1px solid var(--border-default, #E2E8F0)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {t('help.step3_title')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '18px' }}>
                  {t('help.step3_desc')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="btn btn-primary btn-sm"
              >
                {t('user.understand')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Logout Dialog ─────────────────────────────────── */}
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

    </div>
  );
}
