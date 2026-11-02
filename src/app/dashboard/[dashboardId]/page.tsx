'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Backward compatibility redirect:
 * Routes legacy `/dashboard/:dashboardId` visits to canonical `/dashboard/w/:sessionId/:turn`.
 */
export default function DashboardLegacyRedirectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dashboardId = typeof params?.dashboardId === 'string' ? params.dashboardId : '';
    if (!dashboardId) return;

    const shareParam = searchParams?.get('share') || '';
    const fetchAndRedirect = async () => {
      try {
        const query = shareParam ? `?share=${encodeURIComponent(shareParam)}` : '';
        const res = await fetch(`/api/dashboard/${dashboardId}${query}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Dashboard tidak ditemukan.');
        }
        const data = await res.json();
        if (data.sessionId && data.turnIndex) {
          const dest = data.shareUrl || `/dashboard/w/${data.sessionId}/${data.turnIndex}${shareParam ? `?share=${encodeURIComponent(shareParam)}` : ''}`;
          router.replace(dest);
        } else {
          router.replace('/dashboard');
        }
      } catch (err: any) {
        setError(err?.message || 'Gagal mengarahkan ke dashboard.');
      }
    };

    fetchAndRedirect();
  }, [params, router, searchParams]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#64748B' }}>
        <p style={{ fontWeight: 600, color: '#DC2626' }}>{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13 }}
        >
          Kembali ke Dashboard Utama
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#64748B' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#2563EB' }} />
      <span style={{ fontSize: 13 }}>Memuat dashboard...</span>
    </div>
  );
}

