'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Clock,
  RefreshCw,
  Eye,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { AVAILABLE_FEED_PRESETS, FeedPresetType } from '@lib/connectors/feedConnectorService';

interface FeedConnectorTabProps {
  metadata: {
    divisionId: string;
    classification: any;
    status: any;
    version: string;
    reviewDueDate: string | null;
    userGrants?: any[];
  };
  isSubmitting: boolean;
  setIsSubmitting: (submitting: boolean) => void;
  onSuccess: () => void;
  onClose: () => void;
}

export default function FeedConnectorTab({
  metadata,
  isSubmitting,
  setIsSubmitting,
  onSuccess,
  onClose,
}: FeedConnectorTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<FeedPresetType>('kurs-bi');
  const [sourceName, setSourceName] = useState<string>('Kurs Valuta Asing & BI Rate');
  const [customFeedUrl, setCustomFeedUrl] = useState<string>('');
  const [syncSchedule, setSyncSchedule] = useState<'manual' | 'hourly' | 'six_hours' | 'daily' | 'weekly'>('daily');
  const [autoSupersede, setAutoSupersede] = useState<boolean>(true);

  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<{ recordCount: number; previewMarkdown: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePresetSelect = (presetId: FeedPresetType, presetName: string, defaultSched: any) => {
    setSelectedPreset(presetId);
    setSourceName(presetName);
    setSyncSchedule(defaultSched);
    setPreviewResult(null);
    setErrorMsg(null);
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          presetId: selectedPreset,
          sourceName: sourceName.trim(),
          customFeedUrl: selectedPreset === 'custom' ? customFeedUrl.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengambil pratinjau feed');
      }

      setPreviewResult({
        recordCount: data.preview.recordCount,
        previewMarkdown: data.preview.previewMarkdown,
      });
      toast.success(`Data feed siap! ${data.preview.recordCount} entri terdeteksi.`);
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message || 'Gagal memuat pratinjau feed');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSync = async () => {
    if (!sourceName.trim()) {
      toast.error('Nama sumber data feed wajib diisi.');
      return;
    }
    if (selectedPreset === 'custom' && !customFeedUrl.trim()) {
      toast.error('URL Feed eksternal kustom wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/connectors/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          presetId: selectedPreset,
          sourceName: sourceName.trim(),
          customFeedUrl: selectedPreset === 'custom' ? customFeedUrl.trim() : undefined,
          syncSchedule,
          autoSupersede,
          divisionId: metadata.divisionId,
          classification: metadata.classification,
          status: metadata.status,
          version: metadata.version,
          reviewDueDate: metadata.reviewDueDate,
          userGrants: metadata.userGrants,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyinkronkan data feed');
      }

      toast.success(data.message || 'Data feed berhasil diindeks ke pgvector!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error(err.message || 'Gagal menyinkronkan feed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* ── Preset Picker Cards ── */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 650, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
          <TrendingUp size={12} color="#D97706" />
          <span>Pilih Preset Feed Resmi / Data Terjadwal</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {AVAILABLE_FEED_PRESETS.map((p) => {
            const isSelected = selectedPreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handlePresetSelect(p.id, p.name, p.defaultSchedule)}
                style={{
                  padding: '7px 9px',
                  borderRadius: '8px',
                  border: isSelected ? '1.5px solid #D97706' : '1px solid #E2E8F0',
                  backgroundColor: isSelected ? '#FFFBEB' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 1px 3px rgba(217, 119, 6, 0.12)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 650, color: isSelected ? '#B45309' : '#1E293B' }}>
                    {p.name}
                  </span>
                  {isSelected && <Check size={11} color="#D97706" />}
                </div>
                <p style={{ fontSize: '9.5px', color: '#64748B', margin: 0, lineHeight: 1.3 }}>
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Source Name Input ── */}
      <div>
        <label style={{ fontSize: '10.5px', fontWeight: 650, color: '#475569', marginBottom: '3px', display: 'block' }}>
          Nama Dokumen / Sumber Knowledge
        </label>
        <input
          type="text"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder="Contoh: Kurs Valuta Asing Harian & BI Rate"
          style={{
            width: '100%',
            height: '29px',
            padding: '0 8px',
            fontSize: '11px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            outline: 'none',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
          }}
        />
      </div>

      {/* ── Synchronization Schedule & Auto-Supersede Settings ── */}
      <div
        style={{
          padding: '8px 10px',
          borderRadius: '8px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} color="#2563EB" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
              Jadwal Polling / Sinkronisasi
            </span>
          </div>
          <select
            value={syncSchedule}
            onChange={(e) => setSyncSchedule(e.target.value as any)}
            style={{
              height: '26px',
              padding: '0 6px',
              fontSize: '10.5px',
              fontWeight: 600,
              borderRadius: '5px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              cursor: 'pointer',
            }}
          >
            <option value="manual">Manual (Sekali Tarik)</option>
            <option value="hourly">Setiap 1 Jam</option>
            <option value="six_hours">Setiap 6 Jam</option>
            <option value="daily">Harian (08:00 WIB)</option>
            <option value="weekly">Mingguan</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox"
            checked={autoSupersede}
            onChange={(e) => setAutoSupersede(e.target.checked)}
            style={{ accentColor: '#2563EB', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '10px', color: '#475569' }}>
            <strong>Auto-Supersede:</strong> Arsipkan otomatis batch sebelumnya agar AI chatbot selalu menjawab dengan angka terbaru.
          </span>
        </label>
      </div>

      {/* ── Test & Preview Button ── */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing || isSubmitting}
          style={{
            height: '28px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid #FCD34D',
            backgroundColor: '#FEF3C7',
            color: '#B45309',
            fontSize: '11px',
            fontWeight: 650,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: isPreviewing ? 'not-allowed' : 'pointer',
          }}
        >
          {isPreviewing ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
          <span>{isPreviewing ? 'Mengambil Feed...' : 'Uji & Pratinjau Feed'}</span>
        </button>

        <button
          type="button"
          onClick={handleSync}
          disabled={isSubmitting || isPreviewing}
          style={{
            height: '28px',
            padding: '0 14px',
            borderRadius: '6px',
            border: '1px solid #D97706',
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 650,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          <span>{isSubmitting ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
        </button>
      </div>

      {/* ── Preview Result ── */}
      {previewResult && (
        <div
          style={{
            borderRadius: '8px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '5px 8px',
              backgroundColor: '#F1F5F9',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              fontWeight: 650,
              color: '#334155',
            }}
          >
            <span>Pratinjau Snapshot Data Feed ({previewResult.recordCount} Entri)</span>
            <span style={{ color: '#16A34A', fontSize: '10px' }}>✓ Siap Diindeks</span>
          </div>
          <div
            style={{
              maxHeight: '110px',
              overflowY: 'auto',
              padding: '6px 8px',
              fontSize: '10px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              lineHeight: 1.35,
            }}
          >
            {previewResult.previewMarkdown}
          </div>
        </div>
      )}

      {/* ── Error Box ── */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: '6px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FEE2E2',
            color: '#DC2626',
            fontSize: '11px',
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
