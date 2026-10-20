'use client';

import React, { useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

export default function ToastProvider() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'dark' : 'light');
    };

    updateTheme();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          updateTheme();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      theme={theme}
      offset={{ top: 10, right: 12 }}
      gap={6}
      style={{ fontFamily: 'inherit' }}
      toastOptions={{
        style: {
          padding: '7px 11px',
          fontSize: '11.5px',
          borderRadius: '8px',
          maxWidth: '310px',
        },
      }}
    />
  );
}
