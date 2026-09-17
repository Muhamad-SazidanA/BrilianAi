'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Clock, RefreshCw, LogOut, ShieldAlert, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  status: string;
  avatar_color?: string;
  department?: string;
}

function PendingApprovalContent() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Set theme to light by default
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', 'light');
    } catch {}
  }, []);

  // Check current approval status via /api/auth/me
  const checkStatus = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsChecking(true);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        throw new Error('Gagal memeriksa status');
      }

      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      }

      if (data.status === 'active') {
        setIsApproved(true);
        toast.success('Selamat! Akun Anda telah disetujui oleh Super Administrator.');
        try {
          localStorage.setItem('brilian_user_status', 'active');
          document.cookie = 'brilian_user_status=active; path=/; max-age=2592000; SameSite=Lax';
        } catch {}
        setTimeout(() => {
          router.replace('/');
        }, 800);
      } else if (!isSilent) {
        toast.info('Akun Anda masih dalam antrean persetujuan Super Administrator.');
      }
    } catch (err: any) {
      if (!isSilent) {
        toast.error('Gagal menghubungi server: ' + (err.message || 'Periksa koneksi Anda'));
      }
    } finally {
      if (!isSilent) setIsChecking(false);
    }
  }, [router]);

  // Initial fetch on mount
  useEffect(() => {
    checkStatus(true);
  }, [checkStatus]);

  // Auto-polling every 8 seconds to automatically redirect as soon as superadmin approves
  useEffect(() => {
    if (isApproved) return;
    const interval = setInterval(() => {
      checkStatus(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [checkStatus, isApproved]);

  // Handle Logout / Switch Account
  const handleLogout = () => {
    setIsLoggingOut(true);
    try {
      localStorage.removeItem('brilian_active_user_id');
      localStorage.removeItem('brilian_user_status');
      document.cookie = 'brilian_active_user_id=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'brilian_user_status=; path=/; max-age=0; SameSite=Lax';
    } catch {}
    toast.info('Keluar dari sesi akun Google.');
    router.replace('/login');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundImage: "url('/images/BG-Brilian-Login.jpeg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        boxSizing: 'border-box',
        padding: '1rem',
      }}
    >
      {/* Background Soft Ambient Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.85) 0%, rgba(241,245,249,0.92) 100%)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Main Approval Status Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15), 0 1px 3px rgba(0, 0, 0, 0.05)',
          padding: '2.5rem 2rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* App Logo */}
        <div style={{ height: '36px', width: '140px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Image
            src="/images/BrilianLogo-Open-B.svg"
            alt="Brilian.Ai"
            width={140}
            height={36}
            priority
            style={{ objectFit: 'contain', width: '140px', height: '36px' }}
          />
        </div>

        {/* Status Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: isApproved ? '#DCFCE7' : '#FEF3C7',
            color: isApproved ? '#16A34A' : '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: isApproved ? '0 0 0 8px rgba(34, 197, 94, 0.12)' : '0 0 0 8px rgba(245, 158, 11, 0.12)',
            transition: 'all 0.3s ease',
          }}
        >
          {isApproved ? (
            <CheckCircle2 size={32} strokeWidth={2.2} />
          ) : (
            <Clock size={32} strokeWidth={2.2} className="animate-spin-slow" />
          )}
        </div>

        {/* Title & Subtitle */}
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
          }}
        >
          {isApproved ? 'Akun Telah Disetujui' : 'Menunggu Persetujuan Akun'}
        </h1>
        <p
          style={{
            fontSize: '13.5px',
            color: '#64748B',
            lineHeight: 1.5,
            margin: '0 0 1.25rem 0',
          }}
        >
          {isApproved
            ? 'Persetujuan selesai! Menyiapkan dashboard untuk Anda...'
            : 'Akun Google Anda berhasil terdaftar dan sedang dalam antrean verifikasi Super Administrator.'}
        </p>

        {/* User Account Info Card */}
        {user && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '1.25rem',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <UserAvatar name={user.name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#0F172A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Mail size={12} />
                <span>{user.email}</span>
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: isApproved ? '#DCFCE7' : '#FEF3C7',
                color: isApproved ? '#16A34A' : '#B45309',
                border: `1px solid ${isApproved ? '#BBF7D0' : '#FDE68A'}`,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: isApproved ? '#16A34A' : '#F59E0B',
                }}
              />
              {isApproved ? 'Aktif' : 'Pending'}
            </span>
          </div>
        )}

        {/* Security / Notice Box */}
        <div
          style={{
            width: '100%',
            backgroundColor: '#EFF6FF',
            border: '1px solid #DBEAFE',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '1.5rem',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <ShieldAlert size={16} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '12px', color: '#1E40AF', lineHeight: 1.45 }}>
            Demi keamanan sistem perusahaan, Super Administrator akan meninjau dan menetapkan hak akses (Role) sebelum Anda dapat membuka modul dokumen dan Chat AI.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Refresh Check Status Button */}
          <button
            type="button"
            onClick={() => checkStatus(false)}
            disabled={isChecking || isApproved}
            style={{
              width: '100%',
              height: '42px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isChecking || isApproved ? 'not-allowed' : 'pointer',
              opacity: isChecking || isApproved ? 0.75 : 1,
              transition: 'background-color 0.15s ease',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            }}
          >
            {isChecking ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memeriksa Status...</span>
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                <span>Periksa Status Persetujuan</span>
              </>
            )}
          </button>

          {/* Logout / Switch Account */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              width: '100%',
              height: '38px',
              backgroundColor: 'transparent',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.color = '#0F172A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748B';
            }}
          >
            <LogOut size={14} />
            <span>Keluar / Gunakan Akun Lain</span>
          </button>
        </div>

        {/* Subtle Footnote */}
        <div style={{ marginTop: '1.25rem', fontSize: '11.5px', color: '#94A3B8' }}>
          Halaman ini otomatis mengecek status persetujuan setiap beberapa detik.
        </div>
      </div>
    </div>
  );
}

export default function PendingApprovalPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
          }}
        >
          <Loader2 size={32} color="#2563EB" className="animate-spin" />
        </div>
      }
    >
      <PendingApprovalContent />
    </Suspense>
  );
}
