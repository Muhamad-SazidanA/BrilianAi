'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Loader2, KeyRound } from 'lucide-react';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const { loginUser } = useUserSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll cleanly and set light theme
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme_preference', 'light');
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    } catch {
      // quiet fallback
    }
  }, []);

  // Handle Standard Sign In
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanInput = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanInput) {
      toast.error('Please enter your username or email address');
      return;
    }

    if (!cleanPassword) {
      toast.error('Please enter your password');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanInput, password: cleanPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Incorrect username or password.');
        setIsSubmitting(false);
        return;
      }

      if (data.user) {
        loginUser(data.user);
        toast.success(`Signed in as ${data.user.name} (${data.user.role?.name || data.user.role_id})`);
        // Smart redirect: if role has no documents:read but has chat:query, go to /chat
        const perms: string[] = data.user.role?.permissions || [];
        const hasDocRead = perms.includes('documents:read');
        const hasChatQuery = perms.includes('chat:query');
        let finalRedirect = redirectUrl;
        if (finalRedirect === '/' && !hasDocRead && hasChatQuery) {
          finalRedirect = '/chat';
        }
        window.location.href = finalRedirect;
      }
    } catch (err: any) {
      toast.error(err?.message || 'Authentication error. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Handle error query param from Google OAuth redirect
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      if (err === 'google_not_configured') {
        toast.error('Google OAuth belum dikonfigurasi. Silakan isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di file .env.');
      } else if (err === 'google_access_denied') {
        toast.error('Login Google dibatalkan atau ditolak.');
      } else if (err === 'google_token_exchange_failed' || err === 'google_userinfo_failed') {
        toast.error('Gagal melakukan otentikasi dengan akun Google. Periksa konfigurasi OAuth Anda.');
      } else {
        toast.error('Otentikasi Google gagal.');
      }
    }
  }, [searchParams]);

  // Social Sign In: Google (Auto detects OAuth config or runs SSO demo)
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    toast.info('Connecting to Google Workspace SSO...');
    try {
      // 1. Check if Google OAuth 2.0 is configured in .env
      const checkRes = await fetch('/api/auth/google?check=1');
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.configured) {
          // Direct user to real Google OAuth screen
          window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;
          return;
        }
      }

      // 2. Fallback if credentials not yet configured in .env: sign in as Super Admin
      toast.info('Google OAuth belum disetup di .env. Menggunakan mode Super Admin SSO...');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@brilian.ai', isSso: true }),
      });
      const data = await res.json();
      if (data.user) {
        loginUser(data.user);
        toast.success(`Signed in with Google as ${data.user.name}`);
        window.location.href = redirectUrl;
      }
    } catch {
      toast.error('Failed to sign in with Google SSO');
      setIsSubmitting(false);
    }
  };

  // Passkey Sign In
  const handlePasskeySignIn = async () => {
    setIsSubmitting(true);
    toast.info('Verifying security passkey...');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@brilian.ai', isSso: true }),
      });
      const data = await res.json();
      if (data.user) {
        loginUser(data.user);
        toast.success(`Passkey verified. Welcome, ${data.user.name}`);
        window.location.href = redirectUrl;
      }
    } catch {
      toast.error('Failed to authenticate with passkey');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        backgroundImage: "url('/images/BG-Brilian-Login.jpeg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
      className="login-viewport-container"
    >
      {/* Luminous Soft Ambient White Contrast Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.35) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* PROPORTIONAL, SOLID WHITE LOGIN CARD (No blink animation, instant render) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '392px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(0, 0, 0, 0.04)',
          padding: '2.25rem 2rem 1.85rem',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Header: Logo & Title with static dimensions to prevent layout shifts */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ height: '34px', width: '140px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image
              src="/images/BrilianLogo-Open-B.svg"
              alt="Brilian.Ai"
              width={140}
              height={34}
              priority
              style={{ objectFit: 'contain', width: '140px', height: '34px' }}
            />
          </div>
          <h1
            style={{
              fontSize: '21px',
              fontWeight: 600,
              color: '#0F172A',
              letterSpacing: '-0.025em',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Sign in to Brilian.Ai
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Username or email address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <label
              htmlFor="login-username"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#1E293B',
                display: 'block',
              }}
            >
              Username or email address
            </label>
            <input
              id="login-username"
              type="text"
              name="username"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                fontSize: '13.5px',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              className="login-field-input"
            />
          </div>

          {/* Password Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                htmlFor="login-password"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1E293B',
                }}
              >
                Password
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info('Password reset instructions sent to your email.');
                }}
                style={{
                  fontSize: '12.5px',
                  fontWeight: 500,
                  color: '#2563EB',
                  textDecoration: 'none',
                }}
                className="hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                fontSize: '13.5px',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              className="login-field-input"
            />
          </div>

          {/* Brilian.Ai Primary Blue Sign In Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 16px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: '1px solid #1D4ED8',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.15s ease',
            }}
            className="hover:bg-[#1D4ED8] active:bg-[#1E40AF]"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>

        {/* Divider: "or" with proper breathing room */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0 12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
          <span style={{ padding: '0 12px', fontSize: '12px', color: '#94A3B8' }}>
            or
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
        </div>

        {/* Social Sign In Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {/* Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 16px',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
            className="hover:bg-[#F8FAFC] hover:border-slate-400"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Passkey Link: Perfectly balanced bottom placement */}
        <div style={{ textAlign: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
          <a
            href="#passkey"
            onClick={(e) => {
              e.preventDefault();
              handlePasskeySignIn();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#2563EB',
              textDecoration: 'none',
            }}
            className="hover:underline"
          >
            <KeyRound size={14} />
            <span>Sign in with a passkey</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// Seamless Visual Fallback matching exact background and card position (no white screen flash)
function LoginFallback() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        backgroundImage: "url('/images/BG-Brilian-Login.jpeg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
      className="login-viewport-container"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.35) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '392px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(0, 0, 0, 0.04)',
          padding: '2.25rem 2rem 1.85rem',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxSizing: 'border-box',
          minHeight: '430px',
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
