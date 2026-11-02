'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';
import { useUserSession } from '@/context/UserSessionContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  getInactivityConfig,
  calculateInactivityState,
  formatInactivityCountdown,
} from '@lib/security/inactivityConfig';

export default function InactivityGuard() {
  const { currentUser, logout } = useUserSession();
  const { t } = useLanguage();

  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const isTimedOutRef = useRef<boolean>(false);

  // Synchronize last activity to localStorage for multi-tab support
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Throttle user event capture to once per 1000ms to eliminate UI stutter
    if (now - lastThrottleRef.current < 1000) return;

    lastThrottleRef.current = now;
    lastActivityRef.current = now;

    try {
      localStorage.setItem('brilian_last_activity', String(now));
    } catch {}

    // Dismiss warning dialog immediately if user actively interacts
    setShowWarning((prev) => (prev ? false : prev));
  }, []);

  // Handle explicit "Tetap Masuk" / "Stay Signed In" button click
  const handleStaySignedIn = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastThrottleRef.current = now;
    try {
      localStorage.setItem('brilian_last_activity', String(now));
    } catch {}
    setShowWarning(false);
  };

  // Handle explicit manual sign out from warning modal
  const handleSignOutNow = () => {
    setShowWarning(false);
    logout('/login');
  };

  useEffect(() => {
    // Only monitor inactivity when a user is actively authenticated
    if (!currentUser) {
      setShowWarning(false);
      isTimedOutRef.current = false;
      return;
    }

    // Initialize baseline activity timestamp
    const initialNow = Date.now();
    lastActivityRef.current = initialNow;
    isTimedOutRef.current = false;
    try {
      const stored = localStorage.getItem('brilian_last_activity');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed <= initialNow) {
          lastActivityRef.current = parsed;
        }
      } else {
        localStorage.setItem('brilian_last_activity', String(initialNow));
      }
    } catch {}

    const config = getInactivityConfig();

    // DOM Interaction Event Listeners
    const eventNames: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ];

    const handleUserInteraction = () => {
      recordActivity();
    };

    eventNames.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Cross-tab Synchronization via Storage Events
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'brilian_last_activity' && e.newValue) {
        const updatedTime = parseInt(e.newValue, 10);
        if (!isNaN(updatedTime) && updatedTime > lastActivityRef.current) {
          lastActivityRef.current = updatedTime;
          setShowWarning(false);
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // Periodic Inactivity Checker (Runs every second)
    const intervalId = setInterval(() => {
      if (isTimedOutRef.current) return;

      const state = calculateInactivityState(lastActivityRef.current, Date.now(), config);

      if (state.isTimedOut) {
        isTimedOutRef.current = true;
        setShowWarning(false);
        clearInterval(intervalId);
        // Revoke session and redirect to login with timeout notice
        logout('/login?reason=session_timeout');
        return;
      }

      if (state.isWarning) {
        setShowWarning(true);
        setRemainingSeconds(state.remainingSeconds);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      eventNames.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(intervalId);
    };
  }, [currentUser, logout, recordActivity]);

  if (!showWarning || !currentUser) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          padding: '1.5rem',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon Badge */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D97706',
            marginBottom: '14px',
          }}
        >
          <Clock size={24} />
        </div>

        {/* Modal Header */}
        <h3
          id="inactivity-title"
          style={{
            margin: '0 0 6px',
            fontSize: '17px',
            fontWeight: 600,
            color: '#0F172A',
            letterSpacing: '-0.015em',
          }}
        >
          {t('session.inactivity_title') || 'Sesi Tidak Aktif'}
        </h3>

        {/* Live Countdown Display */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '20px',
            margin: '6px 0 12px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sisa Waktu:
          </span>
          <span
            style={{
              fontFamily: 'var(--font-plex-mono), monospace',
              fontSize: '15px',
              fontWeight: 700,
              color: '#B45309',
            }}
          >
            {formatInactivityCountdown(remainingSeconds)}
          </span>
        </div>

        {/* Informative Description */}
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: '#475569',
            lineHeight: 1.5,
          }}
        >
          {t('session.inactivity_desc') ||
            'Sesi akun enterprise Anda akan ditutup secara otomatis untuk menjaga keamanan data. Klik tombol di bawah untuk memperpanjang sesi.'}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSignOutNow}
            style={{
              flex: 1,
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
            }}
            className="hover:bg-slate-50"
          >
            <LogOut size={14} />
            <span>{t('session.sign_out_now') || 'Keluar'}</span>
          </button>

          <button
            type="button"
            onClick={handleStaySignedIn}
            style={{
              flex: 1.5,
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #1D4ED8',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.15s ease',
            }}
            className="hover:bg-blue-700"
          >
            <span>{t('session.stay_signed_in') || 'Tetap Masuk'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

